const { send } = require('micro');
const redirect = require('micro-redirect');


module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', 'access_token=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT');
  redirect(res, 302, "/");
}