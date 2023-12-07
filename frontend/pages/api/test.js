const util = require('./util');
const actions = require('./actions');
const poll = require("./poll")
require("dotenv").config();

const faunadb = require("faunadb");
const q = faunadb.query;

const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });

const stripe = require("stripe")(process.env.STRIPE_SECRET);


// Playground file for testing. 
// Ultimately, I have to change the exports to make things
// actually testable. Not sure if there is a better approach


// console.log in node is annoying, doesn't show all the data.
console.log = (...args) => {
  console.dir(args, {depth: null})
}

const myFunc = async () => {
  try {
  } catch (e) {
    console.error(e)
  }
}


myFunc()