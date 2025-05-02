

const cookie = require("cookie");

const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { teamInfoByAccessTokenSql, monthlyCounts, subscribe: subscribeIfNot, getSqlClient, sql} = require("./util");

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const setMaxCountSql = ({ team_id, plan }) => sql`
  UPDATE team
  SET max_count = ${monthlyCounts[plan]}
  WHERE team_id = ${team_id};
  `

export default async(req, res) => {

  const sqlClient = await getSqlClient();
  try {
    const { plan } = req.body;

    const access_token = getAccessToken(req);
 
    const {rows: [{stripe_id, team_id}]} = await sqlClient.query(teamInfoByAccessTokenSql(access_token));

    const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })

    if (plan !== "poll-app-personal" && customer.sources.total_count === 0) {
      res.status(400).json({error: "Need stripe payment information"})
      return;
    }

    // TODO(DB): Subscribe calls queries
    await subscribeIfNot({ customer, stripe_id, plan, stripe, team_id, sqlClient })


    await sqlClient.query(setMaxCountSql({ team_id, plan}));


    res.status(200).json({ status: "Subscription Updated" });
  } catch (e) {
    console.error(e)
    res.status(500).json({message: e.message});
  } finally {
    await sqlClient.release();
  }
}

