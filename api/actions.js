require('dotenv').config();
const { send } = require('micro');
const parseUrlEncode = require('urlencoded-body-parser');
const { buildPollMessage } = require('./util');

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

module.exports = async (req, res) => {
  try {
    const body = await parseBody(req);

    if (body.actions[0].value === "delete-poll") {
      send(res, 200, deleteMessage)
      return;
    }

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

