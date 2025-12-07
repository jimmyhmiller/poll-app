import { v4 as uuid } from 'uuid';
import { Client, Pool } from 'pg'


const sqlPool = new Pool({
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  host: process.env.SQL_HOST,
  port: process.env.SQL_PORT,
  database: process.env.SQL_DATABASE,
  ssl: {
    ca: process.env.POSTGRES_CERT,
  },
})

const getSqlClient = async () => {
  const client = await sqlPool.connect()
  return {
    release: async function() {
      try {
        console.log("Ending SQL connection");
        client.release();
      } catch (e) {
        console.error(e, "Could not end");
      }
    },
    query: async function(query) {
      try {
        console.log("Querying", query);
        // Intentionally awaiting here so I can catch the error
        var result = await client.query(query);
        return result;
      } catch (e) {
        console.error(e, "SQLERROR: Could not query", query);
      }
    }
  }
}


const partitionAll = require('partition-all');
const crypto = require('crypto');
const timingSafeCompare = require('tsscmp')

const cleanString = (str) =>
  str.replace(/"/g, '')

const removeSmartQuotes = (str) =>
  str.replace(/(\u201C|\u201D)/g, '"')


const matchAll = (text, regex) => {
  // This is a little crazy. But people don't seem to be able to understand
  // quoting things and the /g flag on regexes doesn't do what you want.
  if (text.length === 0) {
    return []
  }
  const match = text.match(regex)
  if (match && match[0]) {
    return [match[0]].concat(matchAll(text.substring(match[0].length).trim(), regex))
  }
  return [];
}

const anonymousAndOptions = (options) => {
  if (options[options.length - 1] && options[options.length - 1].includes("anonymous")) {
    return {
      anonymous: true,
      options: options.slice(0, options.length - 1)
    }
  }
  return {
    anonymous: false,
    options,
  }
}

const parseMessage = (text="") => {

  // This code is super ugly.
  const cleanedText = removeSmartQuotes(text)
  const [question, ...initialOptions] = matchAll(cleanedText,
    /(".+?")|(.+?\?)|(.+? )|(.+$)/)
    .map(cleanString);

  const { anonymous, options } = anonymousAndOptions(initialOptions)

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
  }))
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



const today = () => new Date().toISOString().substring(0, 10)


const addDaysEpoch = (date, days) => {
  // the fact that dates are mutable is terrible
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return Math.floor(newDate.valueOf()/1000);
}

const addDays = (date, days) => {
  // the fact that dates are mutable is terrible
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate.toISOString().substring(0, 10);
}

const startOfMonth = () =>
  `${today().substring(0, 7)}-01`


const maxCountSql = (team_id) => sql`
  SELECT COALESCE(max_count, 0) AS max_count
  FROM team
  WHERE team_id = ${team_id};
  `


const setExpirationDateSql = (date, team_id) => sql`
  UPDATE team
  SET expiration_date = ${date}
  WHERE team_id = ${team_id};
  `

const teamIsExpiredSql = (team_id) => sql`
  SELECT CURRENT_DATE > COALESCE(expiration_date, CURRENT_DATE + INTERVAL '1 day') AS expired
  FROM team
  WHERE team_id = ${team_id};
  `

const incrementMonthSql = ({ team_id }) => sql`
  INSERT INTO team_monthly_counts (team_id, month, count)
  VALUES (${team_id}, date_trunc('month', CURRENT_DATE), 1)
  ON CONFLICT (team_id, month) DO UPDATE
  SET count = team_monthly_counts.count + 1;
  `

const createTeamIfNotExistsSql = (team_id) => sql`
INSERT INTO team (team_id, string_id)
VALUES (${team_id}, ${team_id})
ON CONFLICT (team_id) DO NOTHING;
`

const userInfoByAccessTokenSql = (access_token) => 
  sql`
  select u.*
  from user_data u
  where u.access_token = ${access_token}`


function sql(textFragments, ...values) {
  let text = ''
  for (let i = 0; i < textFragments.length; ++i) {
    if (text !== '') {
      text += `$${i}`
    }
    text += textFragments[i]
  }
  return { text, values }
}

const teamInfoByAccessTokenSql = (access_token) => 
  sql`
    select t.*
    from team t
    join user_data u on t.id = u.team_id
    where u.access_token = ${access_token}`

const upsertTeamSql = ({ team_id }) => sql`
WITH upsert AS (
  SELECT ${team_id} AS team_id
  WHERE NOT EXISTS (SELECT 1 FROM team WHERE team_id = ${team_id})
)
INSERT INTO team (team_id)
SELECT team_id FROM upsert;
`;

const getTeamByTeamIdSql = ({ team_id }) => sql`
SELECT * FROM team WHERE team_id = ${team_id}
`;


const upsertUserAccessTokenSql = ({ team_id, user_id, slack_access_token, access_token }) => sql`
WITH team_lookup AS (
  SELECT id
  FROM team
  WHERE team_id = ${team_id}
)
INSERT INTO user_data (user_id, team_id, slack_token_id, access_token)
SELECT ${user_id}, team_lookup.id, ${slack_access_token}, ${access_token}
FROM team_lookup
ON CONFLICT (user_id) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  slack_token_id = EXCLUDED.slack_token_id,
  access_token = EXCLUDED.access_token
RETURNING *;
`;

const buildPoll = ({question, options, body, anonymous}) => {
  return {
    data: {
      callback_id: uuid(),
      team: body.team_id,
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


const setPlanSql = ({ team_id, plan }) => sql`
  UPDATE team
  SET max_count = ${monthlyCounts[plan]},
      expiration_date = NULL
  WHERE team_id = ${team_id};
  `

const fetchStripeSubscription = async ({ stripe, stripe_id }) => {
  console.log(customer)
  return customer.subscriptions.data[0]
}

const addTrialInfo = async ({stripe, subscription, fromPlan, toPlan}) => {
  if (fromPlan === "poll-app-personal" && toPlan === "poll-app-basic" && !subscription.metadata.has_had_trial) {
    await stripe.subscriptions.update(subscription.id, {
      trial_end: addDaysEpoch(new Date(), 30),
      metadata: {
        has_had_trial: true
      }
    })
  }
}

const subscribeStripe = async ({ customer, plan, stripe, stripe_id }) => {
  const subscription = customer.subscriptions.data[0]
  const fromPlan = subscription && subscription.items.data[0].plan.id;
  if (subscription && fromPlan && fromPlan !== plan) {
    await addTrialInfo({stripe, subscription, fromPlan, toPlan: plan})
    await stripe.subscriptionItems.update(subscription.items.data[0].id, {
      plan,
    })
    return subscription;
  }

  const newSubscription = await stripe.subscriptions.create({
    customer: stripe_id,
    items: [{plan}],
    trial_from_plan: true
  })

  return newSubscription;
}

const updateSubscriptionPlanSql = async ({ team_id, sqlClient, plan }) => {
  return sqlClient.query(setPlanSql({ team_id, plan }))
}

const subscribe = async ({ stripe, stripe_id, customer, plan, sqlClient, team_id }) => {
  const subscription = await subscribeStripe({ stripe, customer, plan, stripe_id })
  await updateSubscriptionPlanSql({ team_id, sqlClient, plan })
  return subscription;
}


const verifySlackMessage = ({ slackSigningSecret, requestSignature, timestamp, body }) => {
  try {
    const currentTime = Math.floor(Date.now() / 1000)
    const fiveMinutes = 60 * 5
    if (Math.abs(currentTime - timestamp) > fiveMinutes) {
      return {
        success: false,
        reason: "InvalidTimeError",
      };
    }

    const [version, hash] = requestSignature.split("=");
    const hmac = crypto.createHmac("sha256", slackSigningSecret);
    hmac.update(`${version}:${timestamp}:${body}`);
    const digest =  hmac.digest('hex');
    if (!timingSafeCompare(hash, digest)) {
      return {
        success: false,
        hash: hash,
        hmac: digest,
        reason: "InvalidSignature",
      }
    }

    return {
      success: true
    }
  } catch (e) {
    console.log("Slack validation failed", body);
    return {
      success: false,
    }
  }
}

const verifySlackRequest = async ({ slackSigningSecret, req}) => {
  const body = await req.rawBody;
  const timestamp = req.headers["x-slack-request-timestamp"];
  const requestSignature = req.headers["x-slack-signature"];
  return verifySlackMessage({ body, timestamp, requestSignature, slackSigningSecret })
}

module.exports = {
  buildPollMessage,
  buildPoll,
  buildOptions,
  parseMessage,
  createTeamIfNotExistsSql,
  incrementMonthSql,
  maxCountSql,
  teamIsExpiredSql,
  ephemeralMessage,
  setExpirationDateSql,
  addDays,
  addDaysEpoch,
  today,
  upsertUserAccessTokenSql,
  userInfoByAccessTokenSql,
  teamInfoByAccessTokenSql,
  upsertTeamSql,
  getTeamByTeamIdSql,
  monthlyCounts,
  setPlanSql,
  addFooterToMessage,
  subscribe,
  updateSubscriptionPlanSql,
  verifySlackRequest,
  getSqlClient,
  sql,
}