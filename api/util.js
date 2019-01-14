const uuid = require('uuid/v4');
const partitionAll = require('partition-all');
const faunadb = require("faunadb");
const q = faunadb.query;

const cleanString = (str) =>
  str.replace(/"/g, '')

const removeSmartQuotes = (str) =>
  str.replace(/(\u201C|\u201D)/g, '"')

const parseMessage = text => {
  const cleanedText = removeSmartQuotes(text)
  const [question, ...options] = cleanedText
    .match(/".*?"/g)
    .map(cleanString);

  const anonymous = cleanedText
    .substring(cleanedText.lastIndexOf("\""))
    .includes("anonymous")

  return {
    question,
    options: buildOptions(options),
    anonymous,
  };
};

const buildAnonymousVotes = (option) => {
  if (option.votes.length > 0) {
    return ` \`${option.votes.length}\``
  } else {
    return ""
  }
}

const buildVotes = (option) => {
  if (option.votes.length > 0) {
    const users = option.votes.map(vote => `<@${vote}>`).join(" ")
    const voteCount = buildAnonymousVotes(option);
    return `${voteCount}\n ${users}`
  }
  return ""
}

const votes = (option, anonymous) => {
  if (anonymous) {
    return buildAnonymousVotes(option)
  }
  return buildVotes(option)
}

const buildFields = (options, anonymous) => {
  return options.map((option, i) => ({
    value: `• ${option.value}${votes(option, anonymous)}`,
    short: false,
  }))
}

const buildActions = (options) => {
  return options.map((option, i) => ({
    text: `${option.value}`,
    type: "button",
    value: `${i}`,
    name: `${i}`,
  }))
}

const buildActionAttachments = (options, callback_id) => {
  const actions = buildActions(options);
  const groups = partitionAll(5, actions);
  return groups.map(group => {
    return {
      fallback: "Your interface does not support interactive messages.",
      callback_id,
      actions: group,
    }
  })
}

const buildMessage = ({ question, options, callback_id, anonymous }) => {
  const actions = buildActions(options)
  return {
    response_type: "in_channel",
    replace_original: "false",
    attachments: [{
      pretext: anonymous ? "This survey is anonymous" : null,
      title: question,
      mrkdwn_in: ["fields"],
      fields: buildFields(options, anonymous),
      fallback: "Your interface does not support interactive messages.",
      callback_id: callback_id,
    }].concat(buildActionAttachments(options, callback_id))
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

const buildPoll = ({question, options, body, anonymous}) => {
  return {
    data: {
      callback_id: uuid(),
      channel: getChannel(body),
      startOfMonth: startOfMonth(),
      anonymous,
      question,
      options,
    }
  }
}

module.exports = {
  buildMessage,
  buildPoll,
  buildOptions,
  parseMessage,
}