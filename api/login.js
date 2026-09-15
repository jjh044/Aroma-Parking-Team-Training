const { isValidEmail, methodNotAllowed, normalizeEmail, readBody, sendJson, setSession } = require("../lib/vercel-api");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!isValidEmail(email)) return sendJson(res, 400, { error: "Enter a valid email address." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });

    setSession(res, email);
    return sendJson(res, 200, { user: { email } });
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Invalid request." });
  }
};
