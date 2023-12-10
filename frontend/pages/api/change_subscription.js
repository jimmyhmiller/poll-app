
const cookie = require("cookie");

const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken, monthlyCounts, subscribe: subscribeIfNot } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });


const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization



export default async(req, res) => {

  try {
    const { plan } = req.body;

    const access_token = getAccessToken(req);
    const { ref: teamRef, data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })

    if (plan !== "poll-app-personal" && customer.sources.total_count === 0) {
      res.status(400).json({error: "Need stripe payment information"})
      return;
    }

    const subscription = await subscribeIfNot({ customer, stripe_id, client, plan, stripe, teamRef})

    await client.query(q.Update(teamRef, {data: {maxCount: monthlyCounts[plan]}}))

    res.status(200).json({ status: "Subscription Updated" });
  } catch (e) {
    console.error(e)
    res.status(500).json({message: e.message});
  }
}

