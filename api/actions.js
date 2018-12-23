require('dotenv').config();
const { send, json, text } = require('micro');
const parseUrlEncode = require('urlencoded-body-parser');
const { setIn } = require('zaphod/compat');
const { buildMessage } = require('./util');

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });


// Slack is stupid and sends form encoded json
const parseBody = async (req) => {
  const body = await parseUrlEncode(req);
  return JSON.parse(body.payload);
}

const getActionIndex = (body) => {
  return parseInt(body.actions[0].value)
}

const getVoteData = (body) => ({
  index: parseInt(body.actions[0].value,10),
  voter: body.user.name,
  callback_id: body.callback_id,
})

const extractData = (poll) => ({
  question: poll.data.question,
  options: poll.data.options,
  callback_id: poll.data.callback_id
})

const vote = ({ callback_id, voter, index }) => {
  return client.query(q.Call(q.Function("vote"), [callback_id, index, voter]))
}

const buildResponse = (poll) => {
  return {
    ...buildMessage(extractData(poll)),
    response_type: "in_channel",
    replace_original: true
  }
}

module.exports = async (req, res) => {
  try {
    const body = await parseBody(req);
    const updatedPoll = await vote(getVoteData(body))
    send(res, 200, buildResponse(updatedPoll));
  } catch (e) {
    send(res, 200, {
      text: `Failed to get body ${e.message}`,
      response_type: "ephemeral",
      replace_original: false
    })
  }
};

// module.exports = {
//   buildResponse,
//   vote,
//   getVoteData,
// }



