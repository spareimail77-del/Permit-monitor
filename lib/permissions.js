// The single source of truth for what each role can do. To change a role's
// rights, edit ROLE_PERMISSIONS below. Keep the database policies in
// supabase/03-login-and-roles.sql in step with this file: they enforce the same
// rules inside the database.
//
// "Applicant" and "holder" are NOT account roles: they describe a person's part
// in one particular permit.

export const ROLE_LABELS = {
  root: "Root",
  manager: "Manager",
  hse: "HSE",
  permit_user: "Permit user",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS);

export const DEFAULT_ROLE = "permit_user";

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "User";
}

const VIEW = ["view_permits"];

export const ROLE_PERMISSIONS = {
  root: [...VIEW, "manage_permits"],
  manager: [...VIEW],
  hse: [...VIEW, "manage_permits"],
  permit_user: [...VIEW],
};

export function can(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

// Which permission a URL needs (besides being signed in). First match wins, so
// put the most specific prefixes first. Pages check again, and so does the
// database; this is only the first lock.
const ROUTE_PERMISSIONS = [
  ["/permits/new", "manage_permits"],
  // Adding permits and files (every route under /api/permits changes data).
  ["/api/permits", "manage_permits"],
];

export function requiredPermissionFor(pathname) {
  for (const [prefix, permission] of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return permission;
  }
  return null;
}
