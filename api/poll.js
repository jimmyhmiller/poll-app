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
} = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

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

const commandMessage = ({ command, args }) => {
  if (command === "help") {
    return addFooterToMessage({
      response_type: "ephemeral",
      replace_original: false,
      attachments: [
        {
          color: "#53a6fb",
          title: "Create a poll.",
          text: "/poll “Favorite food?” “Pizza” “Ice Cream” “Other”"
        }, {
          color: "#53a6fb",
          title: "Create an anonymous poll.",
          text: "/poll “Where to eat?” “Home” “Out” anonymous"
        }
      ]
    })
  } else {
    return ephemeralMessage(`Command ${command} not find. Try \`/poll help\` for more information.`)
  }
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
    const { question, options, anonymous, command, args } = parseMessage(body.text);

    if (command) {
      send(res, 200, commandMessage({ command, args}))
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
