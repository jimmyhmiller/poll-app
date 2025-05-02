
const axios = require("axios");
const url = require('url');
import { v4 as uuid } from 'uuid';
const querystring = require('querystring');
const cookie = require('cookie');
const { upsertUserAccessTokenSql, subscribe, getSqlClient, upsertTeamSql } = require('./util');
const stripe = require("stripe")(process.env.STRIPE_SECRET);


const rootUrl = "https://slack.com/api/oauth.access"

const clientInfo = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET
}

const upsertUserAndTeamInfo = async ({ team_id, user_id, slack_access_token, access_token, sqlClient, sql }) => {
  console.log("upserting");

  const [{rows: [data]}] = await sqlClient.query(upsertTeamSql({team_id}));
  await sqlClient.query(upsertUserAccessTokenSql({ team_id, user_id, slack_access_token, access_token }));
  

  if (data.stripe_id) {
    console.log("Found user");
    return teamInfo
  }

  const { id: stripe_id } = await stripe.customers.create()
  console.log("Updating with stripe info");
  const {rows: [team_data]} = await sqlClient.query(sql`update team set (stripe_id = ${stripe_id}) where team_id = ${team_id}`);

  return team_data;

}

export default async(req, res) => {

  const sqlClient = await getSqlClient();
  try {

    const { code, selected } = querystring.parse(url.parse(req.url).query);
    const requestParams = {
      ...clientInfo,
      code,
      redirect_uri: selected
        ? `https://poll-app.now.sh/oauth?selected=${selected}`
        : "https://poll-app.now.sh/oauth"
    };


    const oauthUrl = `${rootUrl}?${querystring.stringify(requestParams)}`

    const { data: json } = await axios.get(oauthUrl)

    if (!json.ok) {
      console.error(json)
      res.status(400).json("Error encountered.")
      return ;
    }


    const team_id = json.team_id || json.team.id;
    const user_id = json.user_id || json.user.id;
    const slack_access_token = json.access_token;
    const access_token = uuid();

    console.log(team_id, user_id)
    const teamInfo = await upsertUserAndTeamInfo({ team_id, user_id, slack_access_token, access_token, sqlClient })
    // TODO(DB): change the format here

    if (selected === "poll-app-personal") {
      console.log("Personal, so subscribing now")
      const customer = await stripe.customers.retrieve(teamInfo.stripe_id, {
        expand: ["subscriptions", "sources"]
      })

      await subscribe({
        stripe,
        stripe_id: teamInfo.stripe_id,
        customer,
        team_id,
        plan: selected,
        sqlClient,
      });
    }
   
    res.setHeader('Set-Cookie', cookie.serialize('access_token', access_token, {
      httpOnly: true
    }));
    
    if (selected) {
      res.redirect(302, `/?selected=${selected}`)
    } else {
      res.redirect(302, "/");
    }
  }
  catch(e) {
    console.error(e)
    res.status(500).json({message: e.message});
  } finally {
    await sqlClient.release();
  }
}