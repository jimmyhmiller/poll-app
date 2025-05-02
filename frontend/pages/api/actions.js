const parseUrlEncode = require('urlencoded-body-parser');
const { buildPollMessage, verifySlackRequest, ephemeralMessage, getSqlClient, sql } = require('./util');


const slackSigningSecret = process.env.SLACK_SIGNING_SECRET

// Slack is stupid and sends form encoded json
const parseBody = async (req) => {
  const body = await parseUrlEncode(req);
  return JSON.parse(body.payload);
}


const getVoteData = (body) => ({
  index: parseInt(body.actions[0].value, 10),
  voter: body.user.id,
  callback_id: body.callback_id,
})

const extractData = (poll) => ({
  question: poll.data.question,
  options: poll.data.options,
  callback_id: poll.data.callback_id,
  anonymous: poll.data.anonymous,
})


const castVoteSql = async ({ sqlClient, callback_id, voter, index }) => {
  await sqlClient.query('BEGIN');

  try {
    const { rows: [poll] } = await sqlClient.query(sql`
      SELECT info
      FROM poll
      WHERE callback_id = ${callback_id}
      FOR UPDATE;
    `);

    if (!poll) {
      await sqlClient.query('ROLLBACK');
      console.error("SQLERROR: poll not found");
      return "pollNotFound";
    }

    const info = poll.info;

    const newInfo = {
      ...info,
      options: info.options.map(option => {
        const votes = option.votes.filter(v => v !== voter);
        if (option.index === index) {
          votes.push(voter);
        }
        return {
          ...option,
          votes,
        };
      }),
    };

    await sqlClient.query(sql`
      UPDATE poll
      SET info = ${JSON.stringify(newInfo)}::jsonb
      WHERE callback_id = ${callback_id};
    `);


    await sqlClient.query('COMMIT');
    return {
      question: newInfo.question,
      options: newInfo.options,
      callback_id,
      anonymous: newInfo.anonymous,
    }
  } catch (e) {
    await sqlClient.query('ROLLBACK');
    console.error(e, "SQLERROR: poll action failed");
  }
};

const buildResponse = (poll) => {
  return {
    ...buildPollMessage(poll),
    response_type: "in_channel",
    replace_original: true
  }
}

const deleteMessage = ({
  text: "Your poll has been deleted.",
  response_type: "ephemeral",
  replace_original: true,
})

export default async (req, res) => {
  const sqlClient = await getSqlClient();
  try {

    const body = await parseBody(req);

    console.log(body)

    const slackVerification = await verifySlackRequest({ slackSigningSecret, req })
    if (!slackVerification.success) {
      return ephemeralMessage("Could not verify this message originated from slack. Please try again.")
    }

    if (body.actions[0].value === "delete-poll") {
      res.status(200).json(deleteMessage)
      return;
    }

    const updatedPollSql = await castVoteSql({sqlClient, ...getVoteData(body)});

    
    res.status(200).json(buildResponse(updatedPollSql));

  } catch (e) {
    console.error(e)
    res.status(200).json({
      text: `Failed to get body ${e.message}`,
      response_type: "ephemeral",
      replace_original: false
    })

  } finally {
    await sqlClient.release();
  }
};

export const config = {
  api: {
    bodyParser: false,
  },
}

