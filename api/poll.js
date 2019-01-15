require('dotenv').config();
const { send } = require('micro');
const parseUrlEncode = require('urlencoded-body-parser');

const {
  parseMessage,
  buildMessage,
  buildPoll,
  buildOptions,
  incrementMonth,
  currentCount,
  maxCount,
} = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const createPoll = (poll) => {
  return (
    q.If(q.GTE(currentCount(poll), maxCount(poll)),
      false,
      q.Do(
        incrementMonth(poll),
        q.Create(q.Class("polls"), poll),
        true
      )
    )
  )
}

module.exports = async (req, res) => {
  try {
    const body = await parseUrlEncode(req);
    const { question, options, anonymous } = parseMessage(body.text);
    const poll = buildPoll({ question, options, body, anonymous });
    const callback_id = poll.data.callback_id

    const success = await client.query(createPoll(poll));

    if (success) {
      send(res, 200, buildMessage({ question, options, anonymous, callback_id }));
    } else {
      send(res, 200, {
        text: "You have made too many polls this month. Please upgrade your plan to make more polls.",
        response_type: "ephemeral",
        replace_original: false
      })
    }

  } catch (e) {

    send(res, 200, {
      text: `Error Occurred ${e.message}`,
      response_type: "ephemeral",
      replace_original: false
    })
  }
};
