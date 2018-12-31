const uuid = require('uuid/v4');
const faunadb = require("faunadb");
const q = faunadb.query;

const buildActions = (options) => {
  return options.map((option, i) => ({
    text: `${option.value}`,
    type: "button",
    value: `${i}`,
    name: `${i}`,
  }))
}

const voteCount = (option) => {
  if (option.votes.length > 0) {
    return ` \`${option.votes.length}\``
  } else {
    return ""
  }
}

const buildFields = (options) => {
  return options.map((option, i) => ({
    value: `• ${option.value}${voteCount(option)}`,
    short: false,
  }))
}

const buildMessage = ({ question, options, callback_id }) => {
  return {
    response_type: "in_channel",
    replace_original: "false",
    attachments: [{
      pretext: "This survey is anonymous",
        title: question,
      mrkdwn_in: ["fields"],
      fields: buildFields(options),
      fallback: "Your interface does not support interactive messages.",
      callback_id: callback_id,
      actions: buildActions(options)
    }]
  }
}

const buildOptions = (options) => {
  return options.map((option, index) => ({
    value: option,
    votes: [],
    index: index
  }))
}

const createIfNotExists = (className, ref, value) =>
  q.If(q.Not(q.Exists(ref)),
    q.Select("ref", q.Create(q.Class(className), value)),
    q.Select("ref", q.Get(ref)))

const matchIndex = (index, value) =>
  q.Match(q.Index(index), value)

const startOfMonth = () =>
  `${new Date().toISOString().substring(0, 7)}-01`

const getRefByIndex = (index, value) =>
  q.Select("ref", q.Get(q.Match(q.Index(index), value)))


const getChannel = (body) => {
  const indexName = "channels-by-channel-id";
  const channel_id = body.channel_id;
  const channelRef = matchIndex(indexName, channel_id);
  return createIfNotExists("channels", channelRef, { data: { channel_id }})
}

const buildPoll = ({question, options, body}) => {
  return {
    data: {
      callback_id: uuid(),
      channel: getChannel(body),
      startOfMonth: startOfMonth(),
      anonymous: true,
      question: question,
      options: options,
    }
  }
}


module.exports = {
  buildMessage,
  buildPoll,
  buildOptions,
}