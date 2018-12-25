require('dotenv').config();
const { send } = require('micro');
const parseUrlEncode = require('urlencoded-body-parser');
const { buildMessage, buildPoll, buildOptions } = require('./util');

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const cleanString = (str) =>
  str.replace(/"/g, '')

const removeSmartQuotes = (str) =>
  str.replace(/(\u201C|\u201D)/g, '"')

const parseBody = async req => {
  const body = await parseUrlEncode(req);
  const [question, ...options] = removeSmartQuotes(body.text)
    .match(/".*?"/g)
    .map(cleanString);
  return {
    question,
    options: buildOptions(options)
  };
};

const createPoll = (poll) => {
  return client.query(q.Create(q.Class("polls"), poll))
}

module.exports = async (req, res) => {
  try {
    const {question, options} = await parseBody(req);
    const poll = buildPoll(question, options);
    await createPoll(poll);

    send(res, 200, buildMessage({
      question,
      options,
      callback_id: poll.data.callback_id,
    }));
  } catch (e) {
    send(res, 200, {
      text: `Failed to get body ${e.message}`,
      response_type: "ephemeral",
      replace_original: false
    })
  }
};




