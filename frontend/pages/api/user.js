const axios = require("axios");
const cookie = require("cookie");

const { userInfoByAccessTokenSql, teamInfoByAccessTokenSql, getSqlClient, sql } = require("./util");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const fetchStripeSubscription = async ({ stripe_id }) => {
  if (stripe_id) {
    const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })
    // console.log(customer);
    return {
      subscription: customer.subscriptions.data[0] || {},
      hasCard: customer.sources.total_count
    }
  } else {
    return {
      hasCard: false
    }
  }
}

const fetchSlackInfo = async ({ slack_access_token }) => {
  const result = await axios.get("https://slack.com/api/users.identity", {
      headers: {
        authorization: `Bearer ${slack_access_token}`
      }
    });

  return result.data
}

export const getUserData = async (req) => {
  const sqlClient = await getSqlClient();
  try {
    const access_token = getAccessToken(req);

    // console.log(access_token);

    if (!access_token) {
      return {loggedIn: false};
    }

    const [{rows: [{slack_token_id}]}, {rows: [{stripe_id}]}] = await Promise.all([
      sqlClient.query(userInfoByAccessTokenSql(access_token)),
      sqlClient.query(teamInfoByAccessTokenSql(access_token))
    ]);


    const [slack, customerInfo] = await Promise.all([
      fetchSlackInfo({ slack_access_token: slack_token_id }),
      fetchStripeSubscription({ stripe_id })
    ]);

    return {
      slack,
      ...customerInfo,
      loggedIn: slack.ok
    }
  } catch (e) {
    console.error(e)
    return {error: "Unexpected error"}
  } finally {
    await sqlClient.release();
  }
}
 


export default async (req, res) => {

  let result = getUserData();
  if (result.error) {
    res.status(500).json({error: "Unexpected error"})
  } else {
    res.status(200).json(result);
  }
};