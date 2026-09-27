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
  return `${String(staffId).trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}
