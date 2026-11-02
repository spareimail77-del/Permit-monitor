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
  guest: "Guest",
};

// The roles Root can give to a person. "guest" is never assigned by hand: it belongs to
// the temporary accounts made by guest links (Admin -> Guest links).
export const ALL_ROLES = Object.keys(ROLE_LABELS).filter((r) => r !== "guest");

export const DEFAULT_ROLE = "permit_user";

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "User";
}

const VIEW = ["view_permits"];
// Everyone but a guest can open attachments and manage their own account (profile, password).
const MEMBER = [...VIEW, "view_files", "manage_account"];

export const ROLE_PERMISSIONS = {
  root: [...MEMBER, "manage_permits", "manage_options", "view_trash", "purge_trash", "export_data", "manage_users"],
  manager: [...MEMBER],
  hse: [...MEMBER, "manage_permits", "manage_options", "view_trash", "export_data"],
  permit_user: [...MEMBER],
  // A guest (from a guest link) can only look at permits: no files, no account pages.
  guest: [...VIEW],
};

export function can(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

// Which permission a URL needs (besides being signed in). First match wins, so
// put the most specific prefixes first. Pages check again, and so does the
// database; this is only the first lock.
const ROUTE_PERMISSIONS = [
  // The whole Admin area (users, password requests, Staff ID changes): Root only.
  ["/admin", "manage_users"],
  ["/api/admin", "manage_users"],
  ["/permits/new", "manage_permits"],
  ["/permits/edit", "manage_permits"],
  // Dropdown lists (Root and HSE).
  // Trash: Root and HSE see and restore; only Root deletes for good.
  ["/trash", "view_trash"],
  ["/api/trash/purge", "purge_trash"],
  ["/api/trash", "view_trash"],
  // Excel export (Root and HSE).
  ["/api/export", "export_data"],
  ["/lists", "manage_options"],
  ["/api/lists", "manage_options"],
  // Adding permits and files (every route under /api/permits changes data).
  ["/api/permits", "manage_permits"],
  // Attachments (opening a file) and a person's own account pages: not for guests.
  ["/api/files", "view_files"],
  ["/profile", "manage_account"],
  ["/api/profile", "manage_account"],
  ["/change-password", "manage_account"],
  ["/api/auth/change-password", "manage_account"],
];

export function requiredPermissionFor(pathname) {
  for (const [prefix, permission] of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return permission;
  }
  return null;
}
