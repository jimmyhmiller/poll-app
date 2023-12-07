const parseUrlEncode = require('urlencoded-body-parser');
const { buildPollMessage, verifySlackRequest, ephemeralMessage } = require('./util');

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET


// Slack is stupid and sends form encoded json
const parseBody = async (req) => {
  const body = await parseUrlEncode(req);
  return JSON.parse(body.payload);
}

const getActionIndex = (body) => {
  return parseInt(body.actions[0].value)
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

const vote = ({ callback_id, voter, index }) => {
  return client.query(q.Call(q.Function("vote"), [callback_id, index, voter]))
}

const buildResponse = (poll) => {
  return {
    ...buildPollMessage(extractData(poll)),
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

    const updatedPoll = await vote(getVoteData(body))
    res.status(200).json(buildResponse(updatedPoll));

  } catch (e) {
    console.error(e)
    res.status(200).json({
      text: `Failed to get body ${e.message}`,
      response_type: "ephemeral",
      replace_original: false
    })

  }
};

export const config = {
  api: {
    bodyParser: false,
  },
}

