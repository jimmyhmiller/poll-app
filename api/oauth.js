require('dotenv').config();
const request = require('request');
const url = require('url');
const querystring = require('querystring');
const redirect = require('micro-redirect')
const { send } = require('micro');
const { createTeamIfNotExists } = require('./util');


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
      await client.query(createTeamIfNotExists(json.team_id));
      redirect(res, 302, "/");
    } else {
      send(res, 400, "Error encountered: \n" + JSON.stringify(json))
    }
  })
}