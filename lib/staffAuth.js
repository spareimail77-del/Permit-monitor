// Supabase Auth needs an email address internally, but staff sign in with their
// Staff ID. The ID becomes a made-up address at a fixed internal domain. No
// email is ever sent and no real email is collected.
//
// This domain must match the accounts already in Supabase -> Authentication
// -> Users (and any account added by hand there).
export const STAFF_EMAIL_DOMAIN = "staff.permit-log.internal";

export function staffIdToAuthEmail(staffId) {
  return `${String(staffId).trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}
