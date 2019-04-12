const uuid = require('uuid/v4');
const partitionAll = require('partition-all');
const faunadb = require("faunadb");
const q = faunadb.query;

const cleanString = (str) =>
  str.replace(/"/g, '')

const removeSmartQuotes = (str) =>
  str.replace(/(\u201C|\u201D)/g, '"')

const parseMessage = text => {

  // This code is super ugly.
  const cleanedText = removeSmartQuotes(text)
  const [question, ...options] = (cleanedText
    .match(/".*?"/g) || [])
    .map(cleanString);

  if (!question) {
    const [command, ...args] = cleanedText.split(" ")
    return {
      command,
      args,
    }
  }

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
      color: "#53a6fb",
      fallback: "A new poll was made.",
      callback_id,
      actions: group,
    }
  })
}

const ephemeralMessage = (text) => addFooterToMessage({
  attachments: [{
    color: "#53a6fb",
    text,
   }],
  response_type: "ephemeral",
  replace_original: false
})

const buildPollMessage = ({ question, options, callback_id, anonymous }) => {
  const actions = buildActions(options)
  return addFooterToMessage({
    response_type: "in_channel",
    replace_original: "false",
    attachments: [{
      color: "#53a6fb",
      pretext: anonymous ? "This survey is anonymous" : null,
      title: question,
      mrkdwn_in: ["fields"],
      fields: buildFields(options, anonymous),
      fallback: "A new poll was made.",
      callback_id: callback_id,
    }].concat(buildActionAttachments(options, callback_id))
  })
}

const footer = {
  text: "", // without this slack with remove the footer on update
  color: "#53a6fb",
  footer: `<https://poll-app.now.sh|Poll App Settings>`,
  footer_icon: "https://poll-app.now.sh/static/logo-only-bars.png",
}

const addFooterToMessage = (message) => {
  return {
    ...message,
    attachments: message.attachments.concat([footer])
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

 const upsert = (className, ref, value) =>
  q.If(q.Not(q.Exists(ref)),
    q.Select("ref", q.Create(q.Class(className), value)),
    q.Do(
      q.Update(ref, value),
      q.Select("ref", q.Get(ref))))


const matchIndex = (index, value) =>
  q.Match(q.Index(index), value)

const today = () => new Date().toISOString().substring(0, 10)


const addDays = (date, days) => {
  // the fact that dates are mutable is terrible
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate.toISOString().substring(0, 10);
}

const startOfMonth = () =>
  `${today().substring(0, 7)}-01`


const currentCount = (poll) => {
  return q.Select(
    ["data", "monthlyCounts", startOfMonth()],
    q.Get(poll.data.team),
    0
  )
}

const maxCount = (poll) => {
  return q.Select(
    ["data", "maxCount"],
    q.Get(poll.data.team),
    0
  )
}

const setExpirationDate = (date, team_id) => {
  const teamRef = q.Select("ref", q.Get(matchIndex("teams-by-team-id", team_id)));
  return (
    q.Update(teamRef, {
      data: {
        expirationDate: date && q.Date(date)
      }
    })
  )
}

const teamIsExpired = (poll) => {
  const defaultValue = q.Date(addDays(today(), 1));
  const todaysDate = q.Date(today());

  // Default value is tomorrow so it is always greater than today.
  // This works even if we somehow crossed a day boundry between
  // these two lines of code.
  return (
    q.GT(
      todaysDate,
      q.Select(
        ["data", "expirationDate"],
        q.Get(poll.data.team),
        defaultValue)
    )
  )
}

const incrementMonth = (poll) => {
  const now = startOfMonth();
  const teamRef = q.Select("ref", q.Get(poll.data.team));
  return (
    q.Let({
      currentCount: currentCount(poll)
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

const refByIndex = (index, value) => q.Match(q.Index(index), value)

const getRefByIndex = (index, value) =>
  q.Select("ref", q.Get(q.Match(q.Index(index), value)))

const createTeamIfNotExists = (team_id) => {
  const teamRef = matchIndex("teams-by-team-id", team_id);
  return createIfNotExists("teams", teamRef, { data: { team_id }})
}


const userInfoByAccessToken = ({ access_token }) => {
  return q.Get(matchIndex("get-user-by-access-token", access_token))
}

const teamInfoByAccessToken = ({ access_token }) => {
   return q.Get(q.Select(["data", "team"], userInfoByAccessToken({ access_token })))
}

const upsertUserAccessToken = ({ team_id, user_id, slack_access_token, access_token }) => {
  const team = refByIndex("teams-by-team-id", team_id);
  const userRef = refByIndex("users-by-user-id", user_id);
  return q.Do(
    createIfNotExists("teams", team, { data: { team_id }}),
    upsert("users", userRef, { data: { user_id, slack_access_token, access_token, team: q.Select("ref", q.Get(team)) }}),
    q.Get(team)
  )
}

const buildPoll = ({question, options, body, anonymous}) => {
  return {
    data: {
      callback_id: uuid(),
      team: getRefByIndex("teams-by-team-id", body.team_id),
      anonymous,
      question,
      options,
    }
  }
}

const monthlyCounts = {
  "poll-app-personal": 25,
  "poll-app-basic": 50,
  "poll-app-premium": 100,
  "poll-app-enterprise": 10000,
}

const setPlan = ({ teamRef, plan }) => 
  q.Update(teamRef, {data: {maxCount: monthlyCounts[plan], expirationDate: null}})

const fetchStripeSubscription = async ({ stripe, stripe_id }) => {
  console.log(customer)
  return customer.subscriptions.data[0]
}



const subscribe = async ({ customer, client, plan, stripe, teamRef, stripe_id }) => {
  const subscription = customer.subscriptions.data[0]
  if (subscription) {
    await stripe.subscriptionItems.update(subscription.items.data[0].id, {
      plan,
      trial_from_plan: true,
    })
    return subscription;
  }

  const newSubscription = await stripe.subscriptions.create({
    customer: stripe_id,
    items: [{plan}],
    trial_from_plan: true,
  })

  await client.query(setPlan({ teamRef, plan }))
  return newSubscription;
}

module.exports = {
  buildPollMessage,
  buildPoll,
  buildOptions,
  parseMessage,
  createTeamIfNotExists,
  incrementMonth,
  currentCount,
  maxCount,
  teamIsExpired,
  ephemeralMessage,
  setExpirationDate,
  addDays,
  today,
  upsertUserAccessToken,
  userInfoByAccessToken,
  teamInfoByAccessToken,
  monthlyCounts,
  addFooterToMessage,
  getRefByIndex,
  upsert,
  refByIndex,
  subscribe,
}