const util = require('./util');
const actions = require('./actions');
const poll = require("./poll")

// Playground file for testing. 
// Ultimately, I have to change the exports to make things
// actually testable. Not sure if there is a better approach


// console.log in node is annoying, doesn't show all the data.
console.log = (...args) => {
  console.dir(args, {depth: null})
}
