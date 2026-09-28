import crypto from "node:crypto";

// No look-alike characters (0/O, 1/l/I) so a temporary password can be
// read out or typed without mistakes. Server-side only.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTempPassword(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}
