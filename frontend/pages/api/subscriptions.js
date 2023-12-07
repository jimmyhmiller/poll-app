
const cookie = require("cookie");


const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken, subscribe } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


export default async(req, res) => {

  try {
    const { id, email, plan } = await json(req);

    const access_token = getAccessToken(req);
    const { ref: teamRef, data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    await stripe.customers.update(stripe_id, {
      email: email,
      source: id,
    })


    const customer = await stripe.customers.retrieve(stripe_id)
    await subscribe({ customer, client, plan, stripe_id, stripe, teamRef })

    res.status(200).json({ status: "Created!" });
  } catch (e) {
    console.error(e)
    res.status(500).json({message: e.message});
  }
}

