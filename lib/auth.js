import crypto from "crypto";

// Everything here checks a single shared HSE passcode — there's no
// per-user login, just a department-wide gate on the Upload page and
// the /api/upload endpoint. Both HSE_UPLOAD_PASSWORD and AUTH_SECRET
// must be set as environment variables in Vercel; there is
// deliberately no fallback default, so the app fails closed (nobody
// can upload) if they're missing rather than silently using a
// guessable value.

export const SESSION_COOKIE = "hse_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Add it in Vercel → Project → Settings → Environment Variables."
    );
  }
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// A session token is "hse:<expiry-timestamp>.<hmac signature>". There's
// no user identity encoded — knowing the token just proves you passed
// the passcode check before it expired.
export function createSessionToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `hse:${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let expectedSignature;
  try {
    expectedSignature = sign(payload);
  } catch (err) {
    // AUTH_SECRET missing — fail closed rather than throwing a 500
    // for every page view.
    return false;
  }

  const given = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (given.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(given, expected)) return false;

  const expires = Number(payload.split(":")[1]);
  if (!expires || Date.now() > expires) return false;

  return true;
}

export function checkPassword(candidate) {
  const actual = process.env.HSE_UPLOAD_PASSWORD;
  if (!actual || typeof candidate !== "string" || candidate.length === 0) {
    return false;
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
