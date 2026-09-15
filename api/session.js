const { methodNotAllowed, readSession, sendJson } = require("../lib/vercel-api");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);

  const session = readSession(req);
  return sendJson(res, 200, {
    authenticated: Boolean(session),
    user: session ? { email: session.email } : null
  });
};
