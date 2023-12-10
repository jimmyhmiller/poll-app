const cookie = require("cookie");

const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken, today } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });


const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const fetchStripeSubscription = async ({ stripe_id }) => {
  const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })
  return customer.subscriptions.data[0] || {}
}



export default async(req, res) => {

  try {

    const access_token = getAccessToken(req);
    const { ref: teamRef, data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    const subscription = await fetchStripeSubscription({ stripe_id })

    await stripe.subscriptions.cancel(subscription.id, { 
      invoice_now: true,
      prorate: true,
    })

    await client.query(q.Update(teamRef, {data: {expirationDate: today()}}))

    res.status(200).json({ status: "unsubscribed" });
  } catch (e) {
    console.error(e)
    res.status(500).json({message: e.message})
  }
}
