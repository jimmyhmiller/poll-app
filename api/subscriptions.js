require('dotenv').config();
const { send, json } = require("micro");
const stripe = require("stripe")(process.env.STRIPE_SECRET);


// placeholder code for subscriptions

module.exports = async (req, res) => {

  try {
    const { id, email, plan } = await json(req);

    const customer = await stripe.customers.create({
      email: email,
      source: id,
    })

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{plan}]
    })

    send(res, 200, "Created!");
  } catch (e) {
    send(res, 500, e.message);
  }
}

