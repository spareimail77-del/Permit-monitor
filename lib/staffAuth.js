// Supabase Auth needs an email address internally, but HSE staff log
// in with their staff ID, not an email. We map staff ID -> a synthetic,
// never-emailed address at a fixed internal domain, and keep each
// person's real email separately in profiles.email for communication
// only (it is never used to sign in).
//
// This constant must match the domain used in supabase-schema.sql's
// comments and whatever you type into Supabase Dashboard -> Add user.
export const STAFF_EMAIL_DOMAIN = "staff.permit-log.internal";

export function staffIdToAuthEmail(staffId) {
  return `${normalizeStaffId(staffId)}@${STAFF_EMAIL_DOMAIN}`;
}

// Trims and lowercases so "18321", " 18321", "18321 " and any mixed
// case a person types all resolve to the same account — matches what
// the signup trigger stores in profiles.staff_id.
export function normalizeStaffId(staffId) {
  return String(staffId || "").trim().toLowerCase();
}

// Staff IDs are short alphanumeric codes (e.g. "18321"), never the
// literal synthetic email itself. Keeps obviously-wrong input (empty,
// containing "@", too long) from reaching Supabase.
export function isValidStaffId(staffId) {
  const id = normalizeStaffId(staffId);
  return id.length >= 2 && id.length <= 32 && /^[a-z0-9._-]+$/.test(id);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
