const cookie = require("cookie");

const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessTokenSql, today, getSqlClient, sql } = require("./util");


const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const fetchStripeSubscription = async ({ stripe_id }) => {
  const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })
    console.log(customer);
  return customer.subscriptions.data[0] || {}
}

const setExpirationDateTodaySql = (team_id) => sql`
  UPDATE team
  SET expiration_date = ${today()}
  WHERE team_id = ${team_id};
  `

export default async(req, res) => {

  const sqlClient = await getSqlClient();
  try {

    const access_token = getAccessToken(req);
    const {rows: [{stripe_id, team_id}]} = await sqlClient.query(teamInfoByAccessTokenSql(access_token));

    const subscription = await fetchStripeSubscription({ stripe_id })

    await stripe.subscriptions.cancel(subscription.id, { 
      invoice_now: true,
      prorate: true,
    })

    await sqlClient.query(setExpirationDateTodaySql(team_id));

    res.status(200).json({ status: "unsubscribed" });
  } catch (e) {
    console.error(e)
    res.status(500).json({message: e.message})
  } finally {
    await sqlClient.release();
  }
}
