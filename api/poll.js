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
} = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const createPoll = (poll) => {
  return (
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
}

// Ultimately these will be a bit different.
// Need to actually provide actions to remedy these issues.
const overLimitMessage = "You have made too many polls this month. Please upgrade your plan to make more polls."
const expiredMessage = "Your account has expired. Please go to settings to reactivate your account."
const unexpectedError = "An unexpected error has occured";

module.exports = async (req, res) => {
  try {
    const body = await parseUrlEncode(req);
    const { question, options, anonymous } = parseMessage(body.text);
    const poll = buildPoll({ question, options, body, anonymous });
    const callback_id = poll.data.callback_id

    const action = await client.query(createPoll(poll));

    if (action === "created") {
      send(res, 200, buildPollMessage({ question, options, anonymous, callback_id }));
    } else if (action === "overLimit") {
      send(res, 200, ephemeralMesssage(overLimitMessage))
    } else if (action === "expired") {
      send(res, 200, ephemeralMessage(expiredMessage))
    } else {
       send(res, 200, ephemeralMessage(unexpectedError))
    }

  } catch (e) {
    console.error(e);
    send(res, 200, ephemeralMessage(`Error Occurred ${e.message}\n${e.stack}`))
  }
};
