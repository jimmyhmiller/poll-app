
const axios = require("axios");
const url = require('url');
import { v4 as uuid } from 'uuid';
const querystring = require('querystring');
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
  console.log("upserting");
  const teamInfo = await client.query(
    upsertUserAccessToken({ team_id, user_id, slack_access_token, access_token })
  );

  if (teamInfo.data.stripe_id) {
    console.log("Found user");
    return teamInfo
  }

  const { id: stripe_id } = await stripe.customers.create()
  console.log("Updating with stripe info");
  const response = await client.query(q.Update(teamInfo.ref, { data: { stripe_id }}))

  return response

}

// Copied from slack tutorial, needs clean up
export default async(req, res) => {

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
      res.status(400).json("Error encountered.")
      return ;
    }


    const team_id = json.team_id || json.team.id;
    const user_id = json.user_id || json.user.id;
    const slack_access_token = json.access_token;
    const access_token = uuid();

    console.log(team_id, user_id)
    const teamInfo = await upsertUserAndTeamInfo({ team_id, user_id, slack_access_token, access_token })

    if (selected === "poll-app-personal") {
      console.log("Personal, so subscribing now")
      const customer = await stripe.customers.retrieve(teamInfo.data.stripe_id)

      await subscribe({
        stripe,
        client,
        stripe_id: teamInfo.data.stripe_id,
        teamRef: teamInfo.ref,
        customer,
        plan: selected
      });
    }


   
    res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
      httpOnly: true
    }));
    
    if (selected) {
      res.redirect(302, `/?selected=${selected}`)
    } else {
      res.redirect(302, "/");
    }
  }
  catch(e) {
    console.error(e)
    res.status(500).json({message: e.message});
  }
}