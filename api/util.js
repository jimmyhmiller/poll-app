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

const deleteButton = ({
  text: "Delete Poll",
  type: "button",
  style: "danger",
  value: "delete-poll",
  name: "delete-poll",
  confirm: {
    title: "Delete Poll?",
    text: "Are you sure you want to delete this poll? This cannot be undone.",
    ok_text: "Delete",
    dismiss_text: "No",
  },
})

const buildActions = (options) => {
  return options.map((option, i) => ({
    text: `${option.value}`,
    type: "button",
    value: `${i}`,
    name: `${i}`,
  })).concat([deleteButton])
}

const buildActionAttachments = (options, callback_id) => {
  const actions = buildActions(options);
  const groups = partitionAll(5, actions);
  return groups.map(group => {
    return {
      fallback: "A new poll was made.",
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
      fallback: "A new poll was made.",
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


const incrementMonth = (poll) => {
  const now = startOfMonth();
  const team = q.Get(poll.data.team);
  const teamRef = q.Select("ref", team);

  return (
    q.Let({
      currentCount: q.Select(["data", "monthlyCounts", now], team, 0)
    },
      q.Update(teamRef, {
        data: {
          monthlyCounts: {
            [now]: q.Add(1, q.Var("currentCount"))
          }
        }
      })
    )
  )
}

const getRefByIndex = (index, value) =>
  q.Select("ref", q.Get(q.Match(q.Index(index), value)))

const createTeamIfNotExists = (team_id) => {
  const teamRef = matchIndex("teams-by-team-id", team_id);
  return createIfNotExists("teams", teamRef, { data: { team_id }})
}

const buildPoll = ({question, options, body, anonymous}) => {
  return {
    data: {
      callback_id: uuid(),
      team: matchIndex("teams-by-team-id", body.team_id),
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
  createTeamIfNotExists,
  incrementMonth,
}