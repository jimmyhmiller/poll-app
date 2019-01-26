import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Head from 'next/head'
import tinycolor from "tinycolor2"
import {
  CardElement,
  injectStripe,
  Elements,
  StripeProvider,
  CardNumberElement,
  CardExpiryElement,
  CardCVCElement,
} from "react-stripe-elements";

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
      background-color: white;
      border: none;
      border-radius: 4px;
      margin-bottom: 10px;
      box-shadow: inset 0 1px 1px 0 hsla(240,1%,49%,.3),0 1px 0 0 hsla(0,0%,100%,.7)
    }

    input {
      padding-bottom: 10px;
      width: 100%;
      background-color: white;
      -webkit-animation: 1ms void-animation-out;
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

const Button = ({ children, color, filled, onClick = ()=>{} }) => {
  const backgroundColor = filled ? color : "white";
  const hoverColor = filled ?
                    tinycolor(backgroundColor).darken().toString()
                    : tinycolor(color).setAlpha(0.2).toString()
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
        {children}
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


const SelectablePriceCard = ({name, selected, ...props}) => {
  if (selected === "none") {
    return <PriceCard {...props} />
  } else if (selected === name) {
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
        </div>
      </div>
      <div>
        <Button onClick={onClick} color={buttonColor || accentColor} filled={buttonFilled}>
          {buttonText}
        </Button>
      </div>
    </Card>
  </Flex>
);


const selectedProps = (props) => ({
  ...props,
  subtitle: "",
  features: props.features.slice(0,2).concat(["Currently Active"]),
  accentColor: "rgb(83 166 251)",
  buttonText: "Selected",
  buttonFilled: true,
})


const unSelectedProps = (props) => ({
  ...props,
  subtitle: "",
  buttonFilled: false,
  buttonText: "Change Plan",
  features: props.features.slice(0, 2) ,
  accentColor: "gray",
  textColor: "gray",
  buttonColor: "black",
})

const Pricing = ({ selected, setSelected }) => {
  return (
    <Flex direction="row" justify="center" align="flex-end">
      <SelectablePriceCard
        selected={selected}
        name="personal"
        price={0}
        features={["Non-Commercial Use", "25 polls a month"]}
        accentColor="rgb(57 104 178)"
        buttonText="Add To Slack"
        title="Personal"
        onClick={() => { if (selected !== "none") { setSelected("personal") } } }  />
      <SelectablePriceCard
        selected={selected}
        name="basic"
        price={15}
        features={["50 polls a month", "Unlimited Users", "30 day free trial"]}
        buttonFilled={true}
        accentColor="#fb9353"
        subtitle="Most Popular"
        buttonText="Try Now"
        title="Basic"
        onClick={() => { if (selected !== "none") { setSelected("basic") } } }  />
      <SelectablePriceCard
        selected={selected}
        name="premium"
        price={25}
        features={["100 polls a month", "Unlimited Users"]}
        accentColor="rgb(83 166 251)"
        buttonVariant="contained"
        buttonText="Sign Up Now"
        title="Premium"
        onClick={() => { if (selected !== "none") { setSelected("premium") } } } />
      <SelectablePriceCard
        selected={selected}
        name="enterprise"
        price={50}
        features={["Unlimited polls a month", "Unlimited Users"]}
        accentColor="rgb(63, 140, 251)"
        buttonText="Sign Up Now"
        title="Enterprise"
        onClick={() => { if (selected !== "none") { setSelected("enterprise") } } }  />
    </Flex>
  )
}

const LoggedInActions = () =>
  <>
    <Text href="#" color="white" size={16}>{team}<span style={{fontSize:12}}>▼</span></Text>
    <Text href="#" color="white" size={16}>Logout</Text>
  </>

const Header = ({ team }) => {


  return (
    <Flex style={{backgroundColor: "rgb(83, 166, 251)", marginBottom: 20}} direction="row" justify="flex-end">
      <Flex style={{width:130}} direction="row" alignSelf="flex-end">
        <Text href="https://slack.com/oauth/authorize?scope=identity.basic&client_id=35696317461.504169540400" color="white" size={16}>Login</Text>
      </Flex>
    </Flex>
  )
}

const CheckoutForm = injectStripe(({ price, planName }) =>
  <Card style={{width: 253, height: 370, backgroundColor: "#f5f5f7", marginTop: 95, marginBottom:35}} padding={0}>
    <div style={{height:150, backgroundColor: "#e8e9eb"}}>
      <Flex justify="center" align="center" direction="column">
        <div style={{borderRadius: "100%",
                     marginTop:-30,
                     backgroundColor: "white",
                     padding: 10,
                     border: "3px solid #fff",
                     boxShadow: "0 0 0 1px rgba(0,0,0,.18),0 2px 2px 0 rgba(0,0,0,.08)"}}>
          <img style={{width: 50, height: 50}} src="/static/logo.png" />
        </div>
        <Text style={{fontWeight: "bold"}}>Poll App</Text>
        <Text secondary style={{margin:0}}>{planName} - ${price}/month</Text>
      </Flex>
    </div>
    <div style={{padding:20}}>
      <fieldset style={{paddingBottom: 0}}>

        <Flex align="center">
          <input id="email" type="email" placeholder="janedoe@gmail.com" required="" autoComplete="email" />
        </Flex>
      </fieldset>
      <fieldset style={{padding: 5}}>
        <CardNumberElement />
      </fieldset>
      <fieldset style={{padding: 5}}>
        <Flex>
        <div style={{width: "50%"}}>
          <CardExpiryElement />
        </div>
        <div style={{width: "50%"}}>
          <CardCVCElement />
        </div>
        </Flex>
      </fieldset>
      <Flex style={{height: 60}} direction="column" justify="flex-end">
        <Button color="rgb(83 166 251)" onClick={() => {}}>Subscribe</Button>
      </Flex>
    </div>
  </Card>
)

const DemoImage = () =>
  <img style={{width: 253, height: 500, padding: "0 10px"}} src="/static/pixel-white.png" />

const Stripe = ({ price, planName }) => {
  if (!process.browser) {
    return null;
  }
  return (
    <StripeProvider apiKey="pk_test_j1McZfQ85E6wZaJacUIpcV9F">
      <Elements>
        <CheckoutForm price={price} planName={planName} />
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
    console.log(`The follow dev tools are available: ${Object.keys(window.devtools).join(", ")}`)
  }, [])
}

const priceBySelected = {
  basic: 15,
  premium: 25,
  enterprise: 50,
  none: "",
}

const titleCase = (str) => str[0].toUpperCase() + str.substring(1);

export default (props) => {
  const [selected, setSelected]  = useDevState("setSelected", "none");
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
      <Header />
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
          </Flex>

          <Flex direction="column" justify="center" align="center">
            {selected === "none" || selected === "personal" ?
              <DemoImage /> :
              <Stripe
                planName={titleCase(selected)}
                price={priceBySelected[selected]} />
            }
          </Flex>
        </Flex>
      </Container>
      <Container justify="center" style={{paddingTop: 30}}>
        <Pricing selected={selected} setSelected={setSelected} />
      </Container>
    </>
  )
}
