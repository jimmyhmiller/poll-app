const withMDX = require('@next/mdx')()
 
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure `pageExtensions` to include MDX files
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  // Optionally, add any other Next.js config below

  async rewrites() {
    return [
      {
        "source": "/poll",
        "destination": "/api/poll"
      },
      {
        "source": "/oauth",
        "destination": "/api/oauth"
      },
      {
        "source": "/actions",
        "destination": "/api/actions"
      },
      {
        "source": "/subscriptions",
        "destination": "/api/subscriptions"
      },
      {
        "source": "/cancel_subscription",
        "destination": "/api/cancel_subscription"
      },
          {
        "source": "/change_subscription",
        "destination": "/api/change_subscription"
      },
      {
        "source": "/user",
        "destination": "/api/user"
      },
      {
        "source": "/logout",
        "destination": "/api/logout"
      },
    ]
  },
}
 

 module.exports = {
  
}
module.exports = withMDX(nextConfig)