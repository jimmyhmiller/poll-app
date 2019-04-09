const { send, json } = require("micro");
const cookie = require("cookie");

require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken, monthlyCounts, subscribe: subscribeIfNot } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });


const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization



module.exports = async (req, res) => {

  try {
    const { plan } = await json(req);

    const access_token = getAccessToken(req);
    const { ref: teamRef, data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    const customer = await stripe.customers.retrieve(stripe_id)

    if (plan !== "poll-app-personal" && customer.sources.total_count === 0) {
      send(res, 400, {error: "Need stripe payment information"})
      return;
    }

    const subscription = await subscribeIfNot({ customer, stripe_id, client, plan, stripe, teamRef})

    await client.query(q.Update(teamRef, {data: {maxCount: monthlyCounts[plan]}}))

    send(res, 200, { status: "Subscription Updated" });
  } catch (e) {
    console.error(e)
    send(res, 500, {message: e.message});
  }
}

