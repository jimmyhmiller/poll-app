require('dotenv').config();
const axios = require("axios");
const url = require('url');
const uuid = require('uuid/v4');
const querystring = require('querystring');
const redirect = require('micro-redirect');
const { send } = require('micro');
const cookie = require('cookie');
const { createTeamIfNotExists, upsertUserAccessToken } = require('./util');
const stripe = require("stripe")(process.env.STRIPE_SECRET);



const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const rootUrl = "https://slack.com/api/oauth.access"

const clientInfo = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET
}

// Copied from slack tutorial, needs clean up
module.exports = async (req, res) => {

  try {
    const params = querystring.parse(url.parse(req.url).query);
    const code = params.code;
    const requestParams = {
      ...clientInfo,
      code,
    }
    const oauthUrl = `${rootUrl}?${querystring.stringify(requestParams)}`

    const response = await axios.get(oauthUrl)
    const json = response.data;

    if (json.ok) {
      // Slack can't keep their format consistent if you are
      // adding the app or just logging in.
      const team_id = json.team_id || json.team.id;
      const user_id = json.user_id || json.user.id;
      const slack_access_token = json.access_token;
      const access_token = uuid();

      const teamInfo = await client.query(upsertUserAccessToken({ team_id, user_id, slack_access_token, access_token }));

      if (!teamInfo.data.stripe_id) {
        const { id } = await stripe.customers.create()
        await client.query(q.Update(teamInfo.ref, { data: { stripe_id: id }}))
      }

      res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
        httpOnly: true
      }));
      redirect(res, 302, "/");
    } else {
      console.error(json)
      send(res, 400, "Error encountered.")
    }
  }
  catch(e) {
    console.error(e)
    send(res, 500, {message: e.message});
  }
}