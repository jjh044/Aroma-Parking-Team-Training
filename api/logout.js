const { clearSession, methodNotAllowed, sendJson } = require("../lib/vercel-api");

module.exports = function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  clearSession(res);
  return sendJson(res, 200, { ok: true });
};
