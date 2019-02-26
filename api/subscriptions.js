const { send, json } = require("micro");
const cookie = require("cookie");

require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });


const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


// placeholder code for subscriptions

module.exports = async (req, res) => {

  try {
    const { id, email, plan } = await json(req);

    const access_token = getAccessToken(req);
    const { data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    await stripe.customers.update(stripe_id, {
      email: email,
      source: id,
    })

    await stripe.subscriptions.create({
      customer: stripe_id,
      items: [{plan}]
    })

    send(res, 200, { status: "Created!" });
  } catch (e) {
    send(res, 500, {message: e.message});
  }
}

