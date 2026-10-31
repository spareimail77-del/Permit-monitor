// A short-lived, SIGNED note of who the signed-in person is (id, Staff ID, name, role).
//
// Why: middleware used to ask the database "is this account active, which role?" on
// EVERY page, link prefetch and API call, and the layout asked again. That is the
// biggest cost of every click. Now the answer is signed (HMAC) and kept in a cookie for
// CACHE_SECONDS. While it is fresh, middleware and the pages trust it and skip the
// database question.
//
// What this does NOT weaken:
//  - The note is signed with a secret only the server knows, so it cannot be forged or
//    edited, and it only counts for the person it was made for (id must match).
//  - The database still decides what data anyone can read or change (row level security
//    asks the live profile every time), so a disabled account gets no data at once.
//  - API routes that change data do not use the note (getViewerStrict in lib/viewer.js).
//  - A role change, disabling or approval reaches the menus and page locks within
//    CACHE_SECONDS.
//
// Works in middleware (edge) and on the server (Node): only Web Crypto is used.
// If no secret is set, nothing is cached and everything works as before (just slower).

export const CACHE_COOKIE = "hse_pf";
export const CACHE_HEADER = "x-viewer";
export const CACHE_SECONDS = 60;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function cacheSecret() {
  return process.env.SESSION_CACHE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function toB64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const keyFor = (secret, usage) => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

// payload: { id, staffId, name, role } -> "<data>.<signature>"
export async function signNote(payload, secret) {
  if (!secret) return null;
  const data = toB64url(enc.encode(JSON.stringify({ ...payload, exp: Date.now() + CACHE_SECONDS * 1000 })));
  const sig = await crypto.subtle.sign("HMAC", await keyFor(secret, "sign"), enc.encode(data));
  return `${data}.${toB64url(new Uint8Array(sig))}`;
}

// Returns the payload, or null if missing, forged, damaged or older than CACHE_SECONDS.
export async function readNote(token, secret) {
  if (!token || !secret || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const data = token.slice(0, dot);
  try {
    const ok = await crypto.subtle.verify("HMAC", await keyFor(secret, "verify"), fromB64url(token.slice(dot + 1)), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(fromB64url(data)));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!payload.id || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}
