const { methodNotAllowed, readSession, readTrainingContent, sendJson } = require("../lib/vercel-api");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  if (!readSession(req)) return sendJson(res, 401, { error: "Please sign in to continue." });

  return sendJson(res, 200, readTrainingContent());
};
