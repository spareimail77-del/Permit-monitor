import { createHash, randomBytes } from "node:crypto";

// Shared helpers for guest links (server side only: uses node:crypto).

// What Root can choose when creating a link.
export const SESSION_CHOICES = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "24 hours" },
];
export const LINK_CHOICES = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];

// The link itself: 32 random bytes, URL-safe (43 characters). Impossible to guess.
export function newToken() {
  return randomBytes(32).toString("base64url");
}

// Only this scrambled copy is stored; the link cannot be rebuilt from the database.
export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function looksLikeToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{30,64}$/.test(token);
}

// "not_opened" | "active" | "ended" | "never_opened" (expired unopened) | "revoked"
export function linkState(link, now = new Date()) {
  if (link.revoked_at) return "revoked";
  if (!link.opened_at) return new Date(link.link_valid_until) > now ? "not_opened" : "never_opened";
  return link.expires_at && new Date(link.expires_at) > now ? "active" : "ended";
}

// The internal email of a guest account (cannot collide with Staff ID accounts).
export const GUEST_EMAIL_DOMAIN = "guest.permit-log.internal";
