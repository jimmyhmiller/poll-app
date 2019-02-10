require('dotenv').config();
const request = require('request');
const url = require('url');
const uuid = require('uuid/v4');
const querystring = require('querystring');
const redirect = require('micro-redirect')
const { send } = require('micro');
const cookie = require('cookie');
const { createTeamIfNotExists, upsertUserAccessToken } = require('./util');



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
  const params = querystring.parse(url.parse(req.url).query);
  const code = params.code;
  const requestParams = {
    ...clientInfo,
    code,
  }
  const options = {
    uri: `${rootUrl}?${querystring.stringify(requestParams)}`,
    method: 'GET'
  }

  request(options, async (error, response, body) => {
    const json = JSON.parse(body)
    if (json.ok) {
      // Slack can't keep their format consistent if you are
      // adding the app or just logging in.
      const team_id = json.team_id || json.team.id;
      const user_id = json.user_id || json.user.id;
      const slack_access_token = json.access_token;
      const access_token = uuid();
      await client.query(upsertUserAccessToken({ team_id, user_id, slack_access_token, access_token }));
      res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
        httpOnly: true
      }));
      redirect(res, 302, "/");
    } else {
      console.error(json)
      send(res, 400, "Error encountered.")
    }
  })
}