const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TRAINING_FILE = path.join(DATA_DIR, "training-content.json");
const SESSION_COOKIE = "aroma_parking_session";
const sessions = new Map();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
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

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function setSession(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    email: user.email,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14
  });

  res.setHeader(
    "set-cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 14}`
  );
}

function clearSession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader("set-cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, savedPassword) {
  const [salt, hash] = savedPassword.split(":");
  if (!salt || !hash) return false;

  const attempted = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempted, "hex"));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 32) {
        req.destroy();
        reject(new Error("Request body is too large."));
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

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/session") {
    const session = getSession(req);
    return sendJson(res, 200, {
      authenticated: Boolean(session),
      user: session ? { email: session.email } : null
    });
  }

  if (req.method === "GET" && req.url === "/api/categories") {
    if (!getSession(req)) return sendError(res, 401, "Please sign in to continue.");
    return sendJson(res, 200, readJson(TRAINING_FILE, { categories: [] }));
  }

  if (req.method === "POST" && req.url === "/api/signup") {
    const body = await readRequestBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!isValidEmail(email)) return sendError(res, 400, "Enter a valid email address.");
    if (password.length < 8) return sendError(res, 400, "Password must be at least 8 characters.");

    const store = readJson(USERS_FILE, { users: [] });
    if (store.users.some((user) => user.email === email)) {
      return sendError(res, 409, "An account already exists for that email.");
    }

    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    store.users.push(user);
    writeJson(USERS_FILE, store);
    setSession(res, user);
    return sendJson(res, 201, { user: { email: user.email } });
  }

  if (req.method === "POST" && req.url === "/api/login") {
    const body = await readRequestBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const store = readJson(USERS_FILE, { users: [] });
    const user = store.users.find((candidate) => candidate.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendError(res, 401, "Email or password is incorrect.");
    }

    setSession(res, user);
    return sendJson(res, 200, { user: { email: user.email } });
  }

  if (req.method === "POST" && req.url === "/api/logout") {
    clearSession(req, res);
    return sendJson(res, 200, { ok: true });
  }

  return sendError(res, 404, "API route not found.");
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (indexError, indexData) => {
        if (indexError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "content-type": contentTypes[".html"] });
        res.end(indexData);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

ensureDataFiles();

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch((error) => sendError(res, 500, error.message || "Server error."));
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Aroma Parking Training running at http://127.0.0.1:${PORT}`);
});
