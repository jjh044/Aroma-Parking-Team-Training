const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SESSION_COOKIE = "aroma_parking_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
const SESSION_SECRET = process.env.SESSION_SECRET || "aroma-parking-local-preview-secret";
const TRAINING_FILE = path.join(__dirname, "..", "data", "training-content.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(email) {
  const payload = base64Url(
    JSON.stringify({
      email,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000
    })
  );
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.email || Date.now() > session.expiresAt) return null;
    return { email: session.email };
  } catch (error) {
    return null;
  }
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function setSession(res, email) {
  res.setHeader("Set-Cookie", sessionCookie(createSessionToken(email)));
}

function clearSession(res) {
  res.setHeader("Set-Cookie", sessionCookie("", 0));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: "Method not allowed." });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 32) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readTrainingContent() {
  return readJson(TRAINING_FILE, { categories: [] });
}

module.exports = {
  clearSession,
  isValidEmail,
  methodNotAllowed,
  normalizeEmail,
  readBody,
  readSession,
  readTrainingContent,
  sendJson,
  setSession
};
