const uuid = require('uuid/v4');

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
    "attachments": [{
      "pretext": "This survey is anonymous",
        "title": question,
      "mrkdwn_in": ["fields"],
      "fields": buildFields(options),
      "fallback": "Your interface does not support interactive messages.",
      "callback_id": callback_id,
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

const buildPoll = (question, options) => {
  return {
    data: {
      callback_id: uuid(),
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