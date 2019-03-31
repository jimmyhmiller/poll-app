const { send, json } = require("micro");
const cookie = require("cookie");

require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken, monthlyCounts } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });


const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const fetchStripeSubscription = async ({ stripe_id }) => {
  const customer = await stripe.customers.retrieve(stripe_id)
  return customer.subscriptions.data[0] || {}
}



module.exports = async (req, res) => {

  try {
    const { plan } = await json(req);

    const access_token = getAccessToken(req);
    const { ref: teamRef, data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    const subscription = await fetchStripeSubscription({ stripe_id })

    await stripe.subscriptionItems.update(subscription.items.data[0].id, {
      plan
    })

    await client.query(q.Update(teamRef, {data: {maxCount: monthlyCounts[plan]}}))

    send(res, 200, { status: "Subscription Updated" });
  } catch (e) {
    console.error(e)
    send(res, 500, {message: e.message});
  }
}

