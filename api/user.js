const axios = require("axios");
const { send } = require("micro");
const cookie = require("cookie");
require("dotenv").config();
const { getSlackAccessToken } = require("./util");


const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization

module.exports = async (req, res) => {
  try {
    const access_token = getAccessToken(req);

    if (!access_token) {
      send(res, 200, {loggedIn: false})
      return;
    }

    const slack_access_token = await client.query(getSlackAccessToken({ access_token }));
    const response = await axios.get("https://slack.com/api/users.identity", {
      headers: {
        authorization: `Bearer ${slack_access_token}`
      }
    });
    send(res, 200, {
      ...response.data,
      loggedIn: response.data.ok
    })
  } catch (e) {
    console.error(e);
    send(res, 500, "Error")
  }
};