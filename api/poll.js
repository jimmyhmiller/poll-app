require('dotenv').config();
const { send } = require('micro');
const parseUrlEncode = require('urlencoded-body-parser');

const {
  parseMessage,
  buildPollMessage,
  buildPoll,
  buildOptions,
  incrementMonth,
  currentCount,
  maxCount,
  ephemeralMessage,
  teamIsExpired,
  addFooterToMessage,
  verifySlackRequest,
} = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const createPoll = (poll) => {
  return (
    q.If(q.Equals(maxCount(poll), 0),
      "noPlan",
      q.If(q.GTE(currentCount(poll), maxCount(poll)),
        "overLimit",
        q.If(teamIsExpired(poll),
          "expired",
          q.Do(
            incrementMonth(poll),
            q.Create(q.Class("polls"), poll),
            "created"
          )
        )
      )
    )
  )
}

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

module.exports = async (req, res) => {
  try {

    const body = await parseUrlEncode(req);

    const slackVerification = await verifySlackRequest({ slackSigningSecret, req })
    if (!slackVerification.success) {
      return ephemeralMessage("Could not verify this message originated from slack. Please try again.")
    }

    console.log(body.text);

    const { question, options, anonymous, args } = parseMessage(body.text);

    if (question === "help" || question === "" || !question) {
      send(res, 200, await commandMessage({ command: "help", args, req }))
      return;
    }

    if (options.length === 0) {
      send(res, 200, await commandMessage({ command: "NO_OPTIONS", args, req }))
      return;
    }


    const poll = buildPoll({ question, options, body, anonymous });
    const callback_id = poll.data.callback_id

    const action = await client.query(createPoll(poll));

    if (action === "created") {
      send(res, 200, buildPollMessage({ question, options, anonymous, callback_id }));
    } else if (action === "overLimit") {
      send(res, 200, ephemeralMessage(overLimitMessage))
    } else if (action === "expired") {
      send(res, 200, ephemeralMessage(expiredMessage))
    } else if (action === "noPlan") {
      send(res, 200, ephemeralMessage(noPlanMessage))
    } else {
      send(res, 200, ephemeralMessage(unexpectedError))
    }

  } catch (e) {
    console.error(e);
    if (e.message === "instance not found") {
      send(res, 200, ephemeralMessage("Be sure you have an account by clicking the settings link below."))
      return;
    }
    send(res, 200, ephemeralMessage(`Error Occurred ${e.message}\n${e.stack}`))
  }
};
