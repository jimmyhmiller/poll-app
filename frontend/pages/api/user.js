const axios = require("axios");
const cookie = require("cookie");

const { userInfoByAccessToken, teamInfoByAccessToken } = require("./util");
const stripe = require("stripe")(process.env.STRIPE_SECRET);


const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const getAccessToken = (req) =>
  (cookie.parse(req.headers.cookie || '').access_token) ||
  req.headers.authorization


const fetchStripeSubscription = async ({ stripe_id }) => {
  if (stripe_id) {
    const customer = await stripe.customers.retrieve(stripe_id, {
      expand: ["subscriptions", "sources"]
    })
    console.log(customer);
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
  try {
    const access_token = getAccessToken(req);

    console.log(access_token);

    if (!access_token) {
      return {loggedIn: false};
    }
    console.log("getting user info")
    const data = await Promise.all([
      client.query(userInfoByAccessToken({ access_token })),
      client.query(teamInfoByAccessToken({ access_token })),
    ])


    console.log(data);
    const [{ data: { slack_access_token }}, { data: { stripe_id }}] = data;

    console.log("HERE");

    const [slack, customerInfo] = await Promise.all([
      fetchSlackInfo({ slack_access_token }),
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