// Single source of truth for what each role can do.
// To change a role's rights, edit ROLE_PERMISSIONS below — nothing else.
// Keep the Supabase policies in supabase-schema.sql in step with this file
// (they enforce the same rules on the database side).

// "Applicant" and "holder" are NOT account roles. They describe a person's
// part in one particular permit (the Applicant and Holder columns of the
// Excel log), and the same person can be the applicant on one permit and the
// holder on the next, or both on the same one. Both used to be roles here but
// had exactly the same rights, so they are now one ordinary role.
export const ROLE_LABELS = {
  root: "Root",
  manager: "Manager",
  hse: "HSE",
  permit_user: "Permit user",
};

// Roles that can be picked in Admin -> Users.
export const ALL_ROLES = Object.keys(ROLE_LABELS);

// Old values still stored until supabase migration step 33 has been run.
// They behave (and display) exactly like the new ordinary role.
const LEGACY_ROLES = {
  permit_holder: "permit_user",
  permit_applicant: "permit_user",
};

export function normalizeRole(role) {
  return LEGACY_ROLES[role] || role;
}

export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || role || "User";
}

// Everyone who creates an account starts as an ordinary user; only Root
// can give a higher role (Admin -> Users, step 23).
export const DEFAULT_ROLE = "permit_user";

const VIEW = ["view_dashboard", "view_permits"];

export const ROLE_PERMISSIONS = {
  // Full access.
  root: [
    ...VIEW,
    "view_admin_page",
    "upload_excel",
    "manage_attachments",
    "view_archive",
    "manage_archive",
    "export_data",
    "approve_requests",
    "reset_passwords",
    "manage_users",
    "view_activity",
    "manage_activity",
  ],
  // Read-only over everything, plus approving account requests.
  manager: [...VIEW, "view_admin_page", "view_archive", "approve_requests"],
  // What "admin" could do before: uploads and attachments (+ archive),
  // plus read-only access to the activity log (step 25).
  hse: [
    ...VIEW,
    "view_admin_page",
    "upload_excel",
    "manage_attachments",
    "view_archive",
    "manage_archive",
    "export_data",
    "view_activity",
  ],
  // View only, for now. Covers people who apply for permits, hold them, or both.
  permit_user: [...VIEW],
};

export function can(role, permission) {
  return !!ROLE_PERMISSIONS[normalizeRole(role)]?.includes(permission);
}

// Which permission each protected URL needs. First match wins, so the
// most specific paths come first. Used by middleware.js.
const ROUTE_PERMISSIONS = [
  ["/api/admin/attachments", "manage_attachments"],
  ["/api/admin/archive/export", "export_data"],
  ["/api/admin/archive", "manage_archive"],
  ["/api/admin/password-requests", "reset_passwords"],
  ["/api/admin/activity", "manage_activity"], // retention setting: Root only
  ["/api/admin/users", "approve_requests"], // routes re-check per action
  ["/api/admin/id-changes", "approve_requests"], // Staff ID change requests
  ["/api/admin", "manage_users"],
  ["/admin/archive", "view_archive"],
  ["/admin/password-requests", "reset_passwords"],
  ["/admin/users", "approve_requests"],
  ["/admin/id-changes", "approve_requests"],
  ["/admin/activity", "view_activity"],
  ["/admin", "view_admin_page"],
  ["/api/upload", "upload_excel"],
  ["/upload", "upload_excel"],
];

export function requiredPermissionFor(pathname) {
  const hit = ROUTE_PERMISSIONS.find(
    ([p]) => pathname === p || pathname.startsWith(`${p}/`)
  );
  return hit ? hit[1] : null;
}
