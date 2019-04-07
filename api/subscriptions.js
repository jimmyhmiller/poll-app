const { send, json } = require("micro");
const cookie = require("cookie");

require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessToken, subscribe } = require("./util");

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


module.exports = async (req, res) => {

  try {
    const { id, email, plan } = await json(req);

    const access_token = getAccessToken(req);
    const { ref: teamRef, data: { stripe_id } } = await client.query(teamInfoByAccessToken({ access_token }))

    await stripe.customers.update(stripe_id, {
      email: email,
      source: id,
    })

    await subscribe({ stripe_id, client, plan, stripe, teamRef })

    send(res, 200, { status: "Created!" });
  } catch (e) {
    console.error(e)
    send(res, 500, {message: e.message});
  }
}

