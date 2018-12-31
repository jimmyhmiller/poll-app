const { buildMessage, buildPoll, buildOptions } = require('./util');
const { vote, getVoteData, buildResponse } = require('./actions');
require("./poll")

console.log = (...args) => {
  console.dir(args, {depth: null})
}


const request = {
  question: "What is is is?",
  options: buildOptions(["Thing", "Stuff"]),
  body: {
    channel_id: "123"
  }
}

const message = buildMessage({ 
  question: "What is is is?",
  options: buildOptions(["Thing", "Stuff"]),
})


const actionMessage1 = {
  original_message: message,
  "actions": [
    {
      "name": "1",
      "type": "button",
      "value": "1"
    }
  ],
  user: {
    name: "bob"
  },
  callback_id: "123"
}

const actionMessage2 = {
  original_message: message,
  "actions": [
    {
      "name": "0",
      "type": "button",
      "value": "0"
    }
  ],
  user: {
    name: "bob"
  },
  callback_id: "123"
}

const run = async () => {
  try {
    const updatedPoll1 = await vote(getVoteData(actionMessage1))
    console.log(buildResponse(updatedPoll1))
    const updatedPoll2 = await vote(getVoteData(actionMessage2))
    console.log(buildResponse(updatedPoll2))

    console.log(buildPoll(request))
  } catch (e) {
    console.error(e)
  }
}

run()