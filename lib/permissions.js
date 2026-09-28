// Single source of truth for what each role can do.
// To change a role's rights, edit ROLE_PERMISSIONS below — nothing else.
// Keep the Supabase policies in supabase-schema.sql in step with this file
// (they enforce the same rules on the database side).

export const ROLE_LABELS = {
  root: "Root",
  manager: "Manager",
  hse: "HSE",
  permit_holder: "Permit holder",
  permit_applicant: "Permit applicant",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS);

// Everyone who creates an account starts as an ordinary user; only Root
// can give a higher role (Admin -> Users, step 23).
export const DEFAULT_ROLE = "permit_holder";

const VIEW = ["view_dashboard", "view_permits"];

export const ROLE_PERMISSIONS = {
  // Full access.
  root: [
    ...VIEW,
    "view_admin_page",
    "upload_excel",
    "manage_attachments",
    "view_archive",
    "approve_requests",
    "reset_passwords",
    "manage_users",
  ],
  // Read-only over everything, plus approving account requests.
  manager: [...VIEW, "view_admin_page", "view_archive", "approve_requests"],
  // What "admin" could do before: uploads and attachments (+ archive).
  hse: [...VIEW, "view_admin_page", "upload_excel", "manage_attachments", "view_archive"],
  // View only, for now.
  permit_holder: [...VIEW],
  permit_applicant: [...VIEW],
};

export function can(role, permission) {
  return !!ROLE_PERMISSIONS[role]?.includes(permission);
}

// Which permission each protected URL needs. First match wins, so the
// most specific paths come first. Used by middleware.js.
const ROUTE_PERMISSIONS = [
  ["/api/admin/attachments", "manage_attachments"],
  ["/api/admin/password-requests", "reset_passwords"],
  ["/api/admin", "manage_users"],
  ["/admin/archive", "view_archive"],
  ["/admin/password-requests", "reset_passwords"],
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
