const axios = require("axios");
const { send } = require("micro");
const cookie = require("cookie");

require("dotenv").config();
const { userInfoByAccessToken, teamInfoByAccessToken } = require("./util");
const stripe = require("stripe")(process.env.STRIPE_SECRET);


const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const fetchStripeSubscription = async ({ stripe_id }) => {
  if (stripe_id) {
    const customer = await stripe.customers.retrieve(stripe_id)
    return {
      subscription: customer.subscriptions.data[0] || {},
      hasCard: customer.sources.total_count !== 0
    }
  } else {
    return {
      hasCard: false
    }
  }
}

const fetchSlackInfo = async ({ slack_access_token }) => {
  const result = await axios.get("https://slack.com/api/users.identity", {
      headers: {
        authorization: `Bearer ${slack_access_token}`
      }
    });

  return result.data
}

module.exports = async (req, res) => {
  try {
    const access_token = getAccessToken(req);

    if (!access_token) {
      send(res, 200, {loggedIn: false})
      return;
    }
    console.log("getting user info")
    const [{ data: { slack_access_token }}, { data: { stripe_id }}] = await Promise.all([
      client.query(userInfoByAccessToken({ access_token })),
      client.query(teamInfoByAccessToken({ access_token })),
    ])


    const [slack, customerInfo] = await Promise.all([
      fetchSlackInfo({ slack_access_token }),
      fetchStripeSubscription({ stripe_id })
    ]);

    send(res, 200, {
      slack,
      ...customerInfo,
      loggedIn: slack.ok
    })
  } catch (e) {
    console.error(e);
    send(res, 500, {error: "Unexpected error"})
  }
};