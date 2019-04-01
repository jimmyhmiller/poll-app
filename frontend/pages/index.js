import React, { useState, useEffect, useCallback, useReducer } from "react";
import PropTypes from "prop-types";
import Head from 'next/head'
import tinycolor from "tinycolor2"
import cookie from "cookie";
import {
  CardElement,
  injectStripe,
  Elements,
  StripeProvider,
  CardNumberElement,
  CardExpiryElement,
  CardCVCElement,
} from "react-stripe-elements";
import fetch from 'isomorphic-unfetch'
import dateformat  from 'dateformat'

const GlobalStyles = () =>
  <style jsx global>{`
    body {
      margin: 0px;
      font-family: "Roboto", "Helvetica", "Arial", sans-serif;
      font-size: 20px;
    }
    button {
      font-family: "Roboto", "Helvetica", "Arial", sans-serif;
      font-size: 14px;
    }
    h1 {
      font-size: 64px;
      margin: 20px;
    }
    h3 {
      font-size: 24px;
      margin: 20px;
    }

    .flex {
      display: flex;
    }

    .flex.flex-row {
      flex-direction: row;
    }

    .flex.flex-column {
      flex-direction: column;
    }

    .next-to {
      display: flex;
    }

    @media (max-width: 1000px) {
      .flex.flex-row {
        flex-direction: column;
      }
    }
    a {
      text-decoration: none;
    }


    // This styles suck, need to figure out what this should look like

    fieldset {
      //background-color: white;
      border: none;
      // border-radius: 4px;
      margin-bottom: 5px;
     // box-shadow: inset 0 1px 1px 0 hsla(240,1%,49%,.3),0 1px 0 0 hsla(0,0%,100%,.7)
    }

    input {
      margin: 0;
      padding: 0;
      width: 100%;
      font: sans-serif;
      font-size: 14px;
      line-height: 1.2em;
      background-color: transparent;
      height: 1.2em;
      outline: none;
      border: none;
    }

    label {
      padding-bottom: 10px;
      font-size: 12px;
      width: 15%;
      min-width: 70px;
      color: rgb(83 166 251);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }


  `}
  </style>


const Flex = ({ children, direction="default", justify, align, alignSelf, className="flex", style={}, flex }) =>
  <div className={className + " flex-" + direction} style={{
    justifyContent: justify,
    alignItems: align,
    flex: flex,
    alignSelf: alignSelf,
    ...style,
  }}>
    {children}
  </div>

const Container = ({style={}, ...props}) =>
  <Flex
    style={{
      "flex": 1,
      margin: "auto",
      ...style,
    }}
    {...props} />

const Heading1 = ({ text, align="left" }) =>
  <h1 style={{textAlign: align}}>
    {text}
  </h1>

const Heading3 = ({ text, align="left", style={} }) =>
  <h3 style={{
      textAlign: align,
      ...style
    }}>
    {text}
  </h3>

const Text = ({ children, align="left", secondary, size, style={}, color, href }) =>
  <p style={{
    textAlign: align,
    fontSize: size,
    color: color || (secondary ? "rgba(0, 0, 0, 0.54)" : "#000"),
    ...style,
  }}>
    { href ?
      <a style={{color}} href={href}>{children}</a> :
      children
    }
  </p>

const Card = ({ children, accentColor, style={}, padding=20 }) =>
  <div
    style={{
      borderTop: `5px ${accentColor} solid`,
      width: 230,
      margin: 10,
      boxShadow: "0px 1px 3px 0px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 2px 1px -1px rgba(0, 0, 0, 0.12)",
      borderRadius: 5,
      fontSize: 16,
      ...style,
    }}
  >
    <Flex direction="column" justify="center" style={{padding}}>
      {children}
    </Flex>
  </div>

const Button = ({ children, color, filled, text, onClick = ()=>{} }) => {
  const backgroundColor = filled ? color : "white";
  const hoverColor = filled
    ? tinycolor(backgroundColor)
        .darken()
        .toString()
    : tinycolor(color)
        .setAlpha(0.2)
        .toString();

  return (
    <div>
      <button
        onClick={onClick}
        style={{
          color: filled ? "white" : color,
          border: `1px ${color} solid`,
          borderRadius: 4,
          width: "100%",
          height: 30,
        }}
      >
        {text}
      </button>
      <style jsx>{`
        button {
          background-color: ${backgroundColor}
        }
        button:hover {
          background-color: ${hoverColor};
        }
      `}</style>
    </div>
  )
}

const selectedProps = (props) => ({
  ...props,
  subtitle: "",
  accentColor: "rgb(83 166 251)",
  buttonText: "Selected",
  buttonFilled: true,
  notable: true,
})

const unSelectedProps = (props) => ({
  ...props,
  subtitle: "",
  buttonFilled: false,
  buttonText: "Change Plan",
  features: props.features.slice(0, 2),
  accentColor: "gray",
  textColor: "gray",
  buttonColor: "black",
})

const subscribedProps = (props) => ({
  ...props,
  subtitle: "",
  features: props.features.slice(0,2),
  buttonText: "Active",
  buttonFilled: true,
})


const SelectablePriceCard = ({name, selected, subscribed, ...props}) => {
  if (!subscribed && !selected) {
    return <PriceCard {...props} />
  } else if (subscribed === name && (selected === name || !selected)) {
    return <PriceCard {...subscribedProps(selectedProps(props))} />
  } else if (subscribed === name) {
    return <PriceCard {...subscribedProps(unSelectedProps(props))} />
  }else if (selected === name) {
    return <PriceCard {...selectedProps(props)} />
  } else {
    return <PriceCard {...unSelectedProps(props)} />
  }
}

const PriceCard = ({
  title,
  subtitle,
  buttonText,
  textColor="black",
  buttonColor,
  accentColor,
  features,
  price,
  buttonFilled = false,
  onClick,
  notable,
}) => (
  <Flex>
    <Card accentColor={accentColor}>
      <Heading3 style={{ margin: 0, color: textColor }} text={title} align="center" />
      {subtitle && (
        <Text style={{ margin: 0, color: textColor }} secondary align="center">
          {subtitle}
        </Text>
      )}
      <div>
        <Flex direction="row" justify="center" align="center">
          <Text
            style={{ marginTop: 5, marginBottom: 0, fontSize: 32, color: textColor }}
            align="center"
          >
            ${price}<span style={{fontSize:20, color: textColor}}>/mo</span>
          </Text>
        </Flex>
        <div style={{margin: 10}}>
          {features.map(feature =>
            <Text style={{marginBottom: 5, marginTop: 0, color: textColor}} variant="subtitle1" align="center" key={feature}>
              {feature}
            </Text>
          )}
          {features.length === 2 && notable ? <br /> : null}
        </div>
      </div>
      <div>
        <Button
          onClick={onClick}
          color={buttonColor || accentColor}
          filled={buttonFilled}
          text={buttonText} />
      </div>
    </Card>
  </Flex>
);

const Pricing = ({ selected, setSelected, subscribed, loggedIn }) => {
  return (
    <Flex direction="row" justify="center" align="flex-end">
      <SelectablePriceCard
        selected={selected}
        subscribed={subscribed}
        name="poll-app-personal"
        price={0}
        features={["Non-Commercial Use", "25 polls a month"]}
        accentColor="rgb(57 104 178)"
        buttonText="Add To Slack"
        title="Personal"
        onClick={() => { if (loggedIn) { setSelected("poll-app-personal") } } }  />
      <SelectablePriceCard
        selected={selected}
        subscribed={subscribed}
        name="poll-app-basic"
        price={15}
        features={["50 polls a month", "Unlimited Users", "30 day free trial"]}
        buttonFilled={true}
        accentColor="#fb9353"
        subtitle="Most Popular"
        buttonText="Try Now"
        title="Basic"
        onClick={() => { if (loggedIn) { setSelected("poll-app-basic") } } }  />
      <SelectablePriceCard
        selected={selected}
        subscribed={subscribed}
        name="poll-app-premium"
        price={25}
        features={["100 polls a month", "Unlimited Users"]}
        accentColor="rgb(83 166 251)"
        buttonVariant="contained"
        buttonText="Sign Up Now"
        title="Premium"
        onClick={() => { if (loggedIn) { setSelected("poll-app-premium") } } } />
      <SelectablePriceCard
        selected={selected}
        subscribed={subscribed}
        name="poll-app-enterprise"
        price={50}
        features={["Unlimited polls a month", "Unlimited Users"]}
        accentColor="rgb(63, 140, 251)"
        buttonText="Sign Up Now"
        title="Enterprise"
        onClick={() => { if (loggedIn) { setSelected("poll-app-enterprise") } } }  />
    </Flex>
  )
}

const LoggedInActions = ({ team }) =>
  <Flex style={{backgroundColor: "rgb(83, 166, 251)", marginBottom: 20}} direction="row" justify="flex-end">
    <Flex style={{paddingRight: 30, minWidth: 200}} direction="row" alignSelf="flex-end" justify="space-around" align="center">
      <Flex style={{paddingRight:20}} align="center">
        <img src={team.image_34} style={{height: 34, paddingRight:5}} />
        <Text color="white" size={16}>{team.name}</Text>
      </Flex>
      <Text href="/logout" color="white" size={16}>Logout</Text>
    </Flex>
  </Flex>

const Header = ({ team }) => {

  if (team) {
    return (
     <LoggedInActions team={team} />
    )
  }

  return (
    <Flex style={{backgroundColor: "rgb(83, 166, 251)", marginBottom: 20}} direction="row" justify="flex-end">
      <Flex style={{paddingRight: 30}} direction="row" alignSelf="flex-end">
        <Text href="https://slack.com/oauth/authorize?scope=identity.basic,identity.team&client_id=35696317461.504169540400" color="white" size={16}>Login</Text>
      </Flex>
    </Flex>
  )
}


const PlanDescription = ({ price, planName, children }) =>
  <div style={{height:130}}>
    <Flex justify="center" align="center" direction="column">
      <div style={{borderRadius: "100%",
                   marginTop: -40,
                   marginBottom: 0,
                   backgroundColor: "white",
                   padding: 10,
                   border: "3px solid #fff",
                   boxShadow: "0 0 0 2px rgba(0,0,0,.18), 0 2px 2px 5px rgba(0,0,0,.08)"}}>
        <img style={{width: 50, height: 50}} src="/static/logo.png" />
      </div>
      <Text style={{fontWeight: "bold"}}>Poll App</Text>
      <Text secondary style={{margin:0}}>{planName} - ${price}/month</Text>
      {children}
    </Flex>
  </div>

const submitReducer = (state, action) => {
  switch (action.type) {
    case "SUBMIT": {
      return { status: "SUBMITTING" }
    }
    case "SUCCESS": {
      return {
        status: "SUBMITTED",
        payload: action.payload,
      }
    }
    case "ERROR": {
      return {
        status: "SUBMITTED",
        error: action.error,
      }
    }
    default: {
      throw new Error();
    }
  }
}

const useSubmit = (f, deps=[]) => {
  const submitf = useCallback(f, deps);
  const [state, dispatch] = useReducer(submitReducer, {status: undefined});
  const onSubmit = async () => {
    dispatch({ type: "SUBMIT" });
    try {
      const payload = await submitf();
      dispatch({
        type: "SUCCESS",
        payload,
      })
    } catch (error) {
      dispatch({
        type: "ERROR",
        error,
      })
    }
  }
  return [state, onSubmit]
}

const useSubmitButton = (initialText, f, deps=[]) => {
  const [state, onSubmit] = useSubmit(f, deps);

  const isSubmitting = state.status === "SUBMITTING"
  const text = isSubmitting ? "submitting" : initialText;
  return {
    onSubmit,
    onClick: onSubmit,
    disabled: isSubmitting,
    text,
  }
}

const useInput = (initialState) => {
  const [value, setValue] = useState(initialState);
  const onChange = (e) => setValue(e.target.value)
  return {
    value,
    onChange,
  }
}

const CheckoutForm = injectStripe(({ price, planName, stripe, plan, setSubscribed }) => {
  const name = useInput("");
  const email = useInput("");

  const submitProps = useSubmitButton("Subscribe", async () => {
    const { token } = await stripe.createToken({ name: name.value });

    if (token.id) {
      await fetch("/subscriptions", {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plan,
          email: email.value,
          id: token.id
        })

      })

      setSubscribed(plan)
    }

  }, [name.value, email.value, stripe, plan])

  return (
    <Card accentColor="rgb(83 166 251)" style={{width: 253, height: 415, backgroundColor: "#fff", marginTop: 45, marginBottom:35}} padding={0}>
      <PlanDescription price={price} planName={planName} />
      <div style={{padding:20, paddingTop: 10}}>
      <fieldset style={{padding: 5}}>
          <label>Email</label>
          <Flex align="center">
            <input
              {...email}
              id="email"
              type="email"
              placeholder="janedoe@example.com"
              required=""
              autocomplete="email" />
          </Flex>
        </fieldset>
        <fieldset style={{padding: 5}}>
          <label>Name On Card</label>
          <Flex align="center">
            <input
              {...name}
              id="name"
              type="text"
              placeholder="Jane Doe"
              required="" />
          </Flex>
        </fieldset>
        <fieldset style={{padding: 5}}>
          <label>Card Number</label>
          <CardNumberElement />
        </fieldset>
        <fieldset style={{padding: 5}}>
          <Flex>
          <div style={{width: "50%"}}>
            <label>Exp</label>
            <CardExpiryElement />
          </div>
          <div style={{width: "50%"}}>
            <label>CVC</label>
            <CardCVCElement />
          </div>
          </Flex>
        </fieldset>
        <Flex style={{height: 50}} direction="column" justify="flex-end">
          <Button
            color="rgb(83 166 251)"

            {...submitProps} />
        </Flex>
      </div>
    </Card>
  )
})

const DemoImage = () =>
  <img style={{width: 253, height: 500, padding: "0 10px"}} src="/static/pixel-white.png" />

const Stripe = ({ price, planName, plan, setSubscribed }) => {
  if (!process.browser) {
    return null;
  }
  return (
    <StripeProvider apiKey="pk_test_j1McZfQ85E6wZaJacUIpcV9F">
      <Elements>
        <CheckoutForm
          price={price}
          planName={planName}
          plan={plan}
          setSubscribed={setSubscribed} />
      </Elements>
    </StripeProvider>
  )
}

if (process.browser) {
  window.devtools = {}
}

const useDevState = (name, initialState) => {
  const [value, setValue] = useState(initialState);
  if (process.browser) {
    window.devtools[name] = setValue;
  }
  return [value, setValue]
}

const useDevTools = () => {
  useEffect(() => {
    console.log(`The following dev tools are available: ${Object.keys(window.devtools).join(", ")}`)
  }, [])
}

const priceBySelected = {
  "poll-app-personal": 0,
  "poll-app-basic": 15,
  "poll-app-premium": 25,
  "poll-app-enterprise": 50,
}

const nameByPlan = {
  "poll-app-personal": "Personal",
  "poll-app-basic": "Basic",
  "poll-app-premium": "Premium",
  "poll-app-enterprise": "Enterprise",
}

const SubscriptionButton = ({ subscribed, selected, setSubscribed }) => {
  const cancelSubProps = useSubmitButton("Cancel", async () => {
    await fetch("/cancel_subscription", {
      method: "POST",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    })
    setSubscribed(null)

  }, [])

  const changeSubProps = useSubmitButton("Change Subscription", async () => {
    await fetch("/change_subscription", {
      method: "POST",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan: selected
      })
    })

    setSubscribed(selected)
  }, [selected])

  if (subscribed === selected || subscribed && !selected) {
    return (
      <Button
        color="rgb(251, 83, 83)"
        {...cancelSubProps} />
    )
  }
  else if (selected === "poll-app-personal" && !subscribed) {
    return (
      <Button
        color="rgb(83, 166, 251)"
        onClick={() => {}}
        text="Add To Slack" />
    )
  }
  else {
    return (
      <Button
        color="rgb(83, 166, 251)"
        {...changeSubProps} />
    )
  }
}




const ActiveSubscription = ({ subscribed, selected, subscription, setSubscribed }) => {
  const style = {
    width: 253,
    height: 225,
    backgroundColor: "#fff",
    marginTop: 150,
    marginBottom: 120
  };

  const currentShown = selected || subscribed;
  const planName = nameByPlan[currentShown];
  const price = priceBySelected[currentShown]

  const nextChargeDate = subscription.current_period_end && dateformat(new Date(subscription.current_period_end * 1000), "mmmm dS")

  return (
    <Card style={style} accentColor="rgb(83 166 251)" padding={0}>
      <div style={{padding: 20}}>

        <PlanDescription price={price} planName={planName}>
          {price > 0
            ? <Text size={12} style={{padding:0, margin:0}} secondary>Next Charge {nextChargeDate} </Text>
            : <Text size={12} style={{padding:0, margin:0}} secondary>Non-Commercial Use</Text>}
        </PlanDescription>
        <Flex style={{height: 55}} direction="column" justify="flex-end">
          <SubscriptionButton
            setSubscribed={setSubscribed}
            subscribed={subscribed}
            selected={selected} />
        </Flex>
      </div>
    </Card>
  )
}

const SecondaryPanel = ({ selected, subscribed, subscription, setSubscribed, ...rest }) => {
  if (!subscribed && !selected) {
    return <DemoImage {...rest} />
  } else if (subscribed || selected === "poll-app-personal") {
    return (
      <ActiveSubscription
        subscription={subscription}
        subscribed={subscribed}
        selected={selected}
        setSubscribed={setSubscribed} />
    )
  } else {
    return <Stripe setSubscribed={setSubscribed} {...rest} />
  }
}

const titleCase = (str) => str && str[0].toUpperCase() + str.substring(1);

const AddToSlack = () =>
  <a href="https://slack.com/oauth/authorize?client_id=35696317461.504169540400&scope=commands">
    <img
      alt="Add to Slack"
      src="https://platform.slack-edge.com/img/add_to_slack.png"
      srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
      width={139}
      height={40}
    />
  </a>

const Main = ({ user }) => {
  const [subscribed , setSubscribed] = useDevState("setSubscribed", user.subscription && user.subscription.plan && user.subscription.plan.id);
  const [selected, setSelected]  = useDevState("setSelected", null);
  useDevTools();
  return (
    <>
      <Head>
        <title>Poll App - Slack polls made easy</title>
        <link rel="icon" type="image/png" href="/static/favicon.png" sizes="196x196" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://js.stripe.com/v3/"></script>
      </Head>
      <GlobalStyles />
      <Header team={user.slack && user.slack.team} />
      <Container direction="column" justify="center">
        <Flex direction="row" justify="center">
          <Flex direction="column" justify="center">
            <Flex className="next-to" direction="row" align="baseline" justify="center">
              <img style={{width: 75, height: 75 }} src="/static/logo.png" />
              <Heading1
                align="center"
                text="Poll App" />
            </Flex>
            <Flex justify="center">
              <Text secondary align="center" style={{maxWidth: 600}}>
                Make and take polls right in Slack. Gather feedback or make decisions without needing to schedule a meeting.
              </Text>
            </Flex>
            <Flex justify="center">
              <AddToSlack />
            </Flex>
          </Flex>

          <Flex direction="column" justify="center" align="center">
            <SecondaryPanel
              setSubscribed={setSubscribed}
              subscription={user.subscription}
              selected={selected}
              subscribed={subscribed}
              plan={subscribed || selected}
              planName={nameByPlan[subscribed || selected]}
              price={priceBySelected[subscribed || selected]} />
          </Flex>
        </Flex>
      </Container>
      <Container justify="center" style={{paddingTop: 30}}>
        <Pricing
          subscribed={subscribed}
          selected={selected}
          setSelected={setSelected}
          loggedIn={user.loggedIn} />
      </Container>
    </>
  )
}

Main.getInitialProps = async ({ req }) => {

  const host = req.headers.host.startsWith("localhost") ? "poll-app.now.sh" : req.headers.host

  const res = await fetch(`https://${host}/user`, {
    credentials: "include", // polyfill only supports include for cookies
    headers: {
      cookie: req.headers.cookie // Stupid hack around server side rendering stuff
    }
  });
  const user = await res.json();
  return { user };
};

export default Main
