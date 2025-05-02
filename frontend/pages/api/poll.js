import { v4 as uuid } from 'uuid';
const parseUrlEncode = require('urlencoded-body-parser');

const {
  parseMessage,
  buildPollMessage,
  buildPoll,
  ephemeralMessage,
  addFooterToMessage,
  verifySlackRequest,
  sql,
  getSqlClient,
  today,
} = require("./util");


const slackSigningSecret = process.env.SLACK_SIGNING_SECRET


const createPollSql = async ({ sqlClient, poll }) => {
  try {
    const { callback_id, team, anonymous, question, options } = poll.data;
    const team_id = team;

    const { rows: [teamRow] } = await sqlClient.query(sql`
      SELECT max_count, expiration_date
      FROM team
      WHERE team_id = ${team_id};
    `);

    const team_table_id = (await sqlClient.query(sql`
      SELECT id
      FROM team
      WHERE team_id = ${team_id};
    `)).rows[0].id;

    if (!teamRow || teamRow.max_count === 0) {
      return "noPlan";
    }

    const { rows: [countRow] } = await sqlClient.query(sql`
      SELECT count
      FROM team_monthly_counts
      WHERE team_id = ${team_table_id}
        AND month = date_trunc('month', CURRENT_DATE);
    `);
    const currentCount = countRow?.count ?? 0;

    if (currentCount >= teamRow.max_count) {
      return "overLimit";
    }

    const todayDate = today();
    if (teamRow.expiration_date && todayDate > teamRow.expiration_date.toISOString().substring(0, 10)) {
      return "expired";
    }

    await sqlClient.query(sql`
      INSERT INTO team_monthly_counts (team_id, month, count)
      VALUES (${team_table_id}, date_trunc('month', CURRENT_DATE), 1)
      ON CONFLICT (team_id, month)
      DO UPDATE SET count = team_monthly_counts.count + 1;
    `);

    await sqlClient.query(sql`
      INSERT INTO poll (team_id, callback_id, info)
      VALUES (${team_table_id}, ${callback_id}, ${JSON.stringify({ question, options, anonymous })}::jsonb);
    `);

    return "created";
  }
  catch (e) {
    console.error(e, "SQLERROR: Error creating poll");
    return "error";
  }
};

const standardHelp = [
  {
    color: "#53a6fb",
    text: "To use poll app, try one of the commands below."
  },
  {
    color: "#53a6fb",
    title: "Create a poll.",
    text: "/poll “Favorite food?” “Pizza” “Ice Cream” “Other”"
  }, {
    color: "#53a6fb",
    title: "Create an anonymous poll.",
    text: "/poll “Where to eat?” “Home” “Out” anonymous"
  }]

const commandMessage = async ({ command, args, req }) => {

  if (command === "NO_OPTIONS") {
    return addFooterToMessage({
      response_type: "ephemeral",
      replace_original: false,
      attachments: [
      {
          color: "#53a6fb",
          title: "Need Options and A Question",
          text: "It looks like you only sent a question, but no options for people to select. Try adding your options in quotes after your question like the examples below."
      },
       ...standardHelp,
      ]
    })
  }

  return addFooterToMessage({
    response_type: "ephemeral",
    replace_original: false,
    attachments: [...standardHelp, {
        color: "#53a6fb",
        title: "Still having trouble?",
        text: "Try using quotes like the examples above do. Quotes help Poll App know what part is a question and which parts are the choices."
      }
    ]
  })
}

// Ultimately these will be a bit different.
// Need to actually provide actions to remedy these issues.
const overLimitMessage = "You have made too many polls this month. Please upgrade your plan to make more polls."
const expiredMessage = "Your account has expired. Please go to settings to reactivate your account."
const noPlanMessage = "Be sure to choose a plan by clicking on the poll-app settings below."
const unexpectedError = "An unexpected error has occured";

export default async(req, res) => {
  const sqlClient = await getSqlClient();
  try {

    const body = await parseUrlEncode(req);
    console.log(body);

    const slackVerification = await verifySlackRequest({ slackSigningSecret, req })
    if (!slackVerification.success) {
      return ephemeralMessage("Could not verify this message originated from slack. Please try again.")
    }

    console.log(body.text);

    const { question, options, anonymous, args } = parseMessage(body.text);

    if (question === "help" || question === "" || !question) {
      res.status(200).json(await commandMessage({ command: "help", args, req }))
      return;
    }

    if (options.length === 0) {
      res.status(200).json(await commandMessage({ command: "NO_OPTIONS", args, req }))
      return;
    }


    // TODO: Get rid of this
    const poll = buildPoll({ question, options, body, anonymous });

    const callback_id = poll.data.callback_id

    const action = await createPollSql({ sqlClient, poll });

    if (action === "created") {
      res.status(200).json(buildPollMessage({ question, options, anonymous, callback_id }));
    } else if (action === "overLimit") {
      console.log("Over limit!");
      res.status(200).json(ephemeralMessage(overLimitMessage))
    } else if (action === "expired") {
      res.status(200).json(ephemeralMessage(expiredMessage))
    } else if (action === "noPlan") {
      res.status(200).json(ephemeralMessage(noPlanMessage))
    } else {
      res.status(200).json(ephemeralMessage(unexpectedError))
    }

  } catch (e) {
    console.error(e);
    if (e.message === "instance not found") {
      res.status(200).json(ephemeralMessage("Be sure you have an account by clicking the settings link below."))
      return;
    }
    res.status(500).json(ephemeralMessage(`Error Occurred ${e.message}\n${e.stack}`))
  } finally {
    sqlClient.release();
  }
};


export const config = {
  api: {
    bodyParser: false,
  },
}
