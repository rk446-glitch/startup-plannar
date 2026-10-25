const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { getPool, isDatabaseConfigured } = require("../db");

const scrypt = promisify(crypto.scrypt);
const sessions = new Map();
const SESSION_COOKIE = "foundry_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : "";
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}${secure}`,
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
  );
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(response, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  if (isDatabaseConfigured()) {
    const tokenHash = hashSessionToken(token);
    await getPool().query("DELETE FROM sessions WHERE expires_at <= NOW()");
    await getPool().query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, to_timestamp($3 / 1000.0))`,
      [tokenHash, userId, expiresAt],
    );
  } else {
    for (const [existingToken, session] of sessions) {
      if (session.expiresAt <= Date.now()) sessions.delete(existingToken);
    }
    sessions.set(token, { userId, expiresAt });
  }
  setSessionCookie(response, token);
}

async function revokeSession(request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return;
  if (isDatabaseConfigured()) {
    await getPool().query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  } else {
    sessions.delete(token);
  }
}

async function getSessionUserId(request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token && isDatabaseConfigured()) {
    const tokenHash = hashSessionToken(token);
    const result = await getPool().query(
      "SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW()",
      [tokenHash],
    );
    return result.rows[0]?.user_id ?? null;
  }
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}

async function requireAuth(request, response, next) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      response.status(401).json({ success: false, error: "Authentication is required." });
      return;
    }
    request.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = await scrypt(password, salt, 64);
  return { salt, passwordHash: derivedKey.toString("hex") };
}

async function verifyPassword(password, salt, expectedHash) {
  const { passwordHash } = await hashPassword(password, salt);
  const actual = Buffer.from(passwordHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  clearSessionCookie,
  createSession,
  getSessionUserId,
  hashPassword,
  requireAuth,
  revokeSession,
  verifyPassword,
};
