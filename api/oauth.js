require('dotenv').config();
const axios = require("axios");
const url = require('url');
const uuid = require('uuid/v4');
const querystring = require('querystring');
const redirect = require('micro-redirect');
const { send } = require('micro');
const cookie = require('cookie');
const { createTeamIfNotExists, upsertUserAccessToken, subscribe } = require('./util');
const stripe = require("stripe")(process.env.STRIPE_SECRET);



const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const rootUrl = "https://slack.com/api/oauth.access"

const clientInfo = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET
}

const upsertUserAndTeamInfo = async ({ team_id, user_id, slack_access_token, access_token }) => {
  const teamInfo = await client.query(
    upsertUserAccessToken({ team_id, user_id, slack_access_token, access_token })
  );

  if (teamInfo.data.stripe_id) {
    return teamInfo
  }

  const { stripe_id } = await stripe.customers.create()
  const response = await client.query(q.Update(teamInfo.ref, { data: { stripe_id: id }}))

  return response.data;

}

// Copied from slack tutorial, needs clean up
module.exports = async (req, res) => {

  try {
    const { code, selected } = querystring.parse(url.parse(req.url).query);
    const requestParams = {
      ...clientInfo,
      code,
      redirect_uri: selected
        ? `https://poll-app.now.sh/oauth?selected=${selected}`
        : "https://poll-app.now.sh/oauth"
    };


    const oauthUrl = `${rootUrl}?${querystring.stringify(requestParams)}`

    const { data: json } = await axios.get(oauthUrl)

    if (!json.ok) {
      console.error(json)
      send(res, 400, "Error encountered.")
      return ;
    }


    const team_id = json.team_id || json.team.id;
    const user_id = json.user_id || json.user.id;
    const slack_access_token = json.access_token;
    const access_token = uuid();

    const teamInfo = await upsertUserAndTeamInfo({ team_id, user_id, slack_access_token, access_token })

    if (selected === "poll-app-personal") {
      await subscribe({
        stripe,
        client,
        teamRef: teamInfo.ref,
        stripe_id: teamInfo.data.stripe_id,
        plan: selected
      });
    }


   
    res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
      httpOnly: true
    }));
    
    if (selected) {
      redirect(res, 302, `/?selected=${selected}`);
    } else {
      redirect(res, 302, "/");
    }
  }
  catch(e) {
    console.error(e)
    send(res, 500, {message: e.message});
  }
}