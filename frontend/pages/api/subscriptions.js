
const cookie = require("cookie");


const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessTokenSql, subscribe, getSqlClient  } = require("./util");

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


export default async(req, res) => {

  const sqlClient = await getSqlClient();
  try {
    const { id, email, plan } = req.body;

    const access_token = getAccessToken(req);
    const {rows: [{stripe_id, team_id}]} = await sqlClient.query(teamInfoByAccessTokenSql(access_token));

    await stripe.customers.update(stripe_id, {
      email: email,
      source: id,
    })


    const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })
    await subscribe({ customer, plan, stripe_id, stripe, teamRef, sqlClient, team_id })

    res.status(200).json({ status: "Created!" });
  } catch (e) {
    console.error(e)
    res.status(500).json({message: e.message});
  } finally {
    await sqlClient.release();
  }
}

