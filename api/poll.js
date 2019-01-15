require('dotenv').config();
const { send } = require('micro');
const parseUrlEncode = require('urlencoded-body-parser');
const { parseMessage, buildMessage, buildPoll, buildOptions, incrementMonth } = require('./util');

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const createPoll = (poll) => {
  return client.query(
    q.Do(
      incrementMonth(poll),
      q.Create(q.Class("polls"), poll),
    )
  )
}

const startOfMonth = () =>
  `${new Date().toISOString().substring(0, 7)}-01`


module.exports = async (req, res) => {
  try {
    const body = await parseUrlEncode(req);
    const { question, options, anonymous } = parseMessage(body.text);
    const poll = buildPoll({ question, options, body, anonymous });
    await createPoll(poll);

    send(res, 200, buildMessage({
      question,
      options,
      anonymous,
      callback_id: poll.data.callback_id,
    }));

  } catch (e) {

    send(res, 200, {
      text: `Error Occurred ${e.message}`,
      response_type: "ephemeral",
      replace_original: false
    })
  }
};
