import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "./supabase/server";
import { getCurrentUser } from "./supabase/user";
import { can } from "./permissions";
import { CACHE_HEADER, cacheSecret, readNote } from "./sessionCache";

function toViewer(id, staffId, name, role, guestExpiresAt = null) {
  return {
    id,
    staffId,
    name: name || staffId,
    role,
    isGuest: role === "guest",
    // For a guest: how long is left, in milliseconds, as of now (the banner counts down from it).
    guestRemainingMs: role === "guest" && guestExpiresAt ? Math.max(0, new Date(guestExpiresAt).getTime() - Date.now()) : null,
    canViewFiles: can(role, "view_files"),
    canManageAccount: can(role, "manage_account"),
    canManagePermits: can(role, "manage_permits"),
    canManageUsers: can(role, "manage_users"),
    canManageOptions: can(role, "manage_options"),
    canViewTrash: can(role, "view_trash"),
    canExport: can(role, "export_data"),
    canPurgeTrash: can(role, "purge_trash"),
  };
}

// The exact check, straight from the database: who is signed in, is the account active,
// which role. Used wherever data is CHANGED (API routes) and on account pages, so a role
// change or a disabled account counts at once there. Cached for one request.
// Returns null when nobody is signed in.
export const getViewerStrict = cache(async () => {
  const supabase = createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id, display_name, role, status, guest_expires_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.status !== "active") return null;
  // A guest whose time is over is nobody (the database agrees: active_role() is null).
  if (profile.role === "guest" && !(profile.guest_expires_at && new Date(profile.guest_expires_at) > new Date())) return null;

  return toViewer(user.id, profile.staff_id, profile.display_name, profile.role, profile.guest_expires_at);
});

// Who is looking at this page? For showing pages and menus. Middleware has already
// checked the session and passes a signed note (lib/sessionCache.js), so normally this
// costs no database call at all. Without a valid note it falls back to the exact check.
// The database still decides what data the person can read (row level security).
export const getViewer = cache(async () => {
  try {
    const secret = cacheSecret();
    const token = secret ? headers().get(CACHE_HEADER) : null;
    const note = await readNote(token, secret);
    if (note) return toViewer(note.id, note.staffId, note.name, note.role);
  } catch {
    // No request headers here: use the exact check.
  }
  return getViewerStrict();
});
