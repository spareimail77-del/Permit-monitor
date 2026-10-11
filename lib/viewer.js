import { cache } from "react";
import { createClient } from "./supabase/server";
import { getCurrentUser } from "./supabase/user";
import { can } from "./permissions";

// Who is looking at this page? Cached for the length of one request, so the
// layout and the page can both ask without a second database call.
// Returns null when nobody is signed in.
export const getViewer = cache(async () => {
  const supabase = createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id, display_name, role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.status !== "active") return null;

  return {
    id: user.id,
    staffId: profile.staff_id,
    name: profile.display_name || profile.staff_id,
    role: profile.role,
    canManagePermits: can(profile.role, "manage_permits"),
    canManageUsers: can(profile.role, "manage_users"),
    canManageOptions: can(profile.role, "manage_options"),
    canViewTrash: can(profile.role, "view_trash"),
    canPurgeTrash: can(profile.role, "purge_trash"),
  };
});
