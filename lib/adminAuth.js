import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { can } from "./permissions";

function fail(message, status) {
  return { error: Response.json({ error: message }, { status }) };
}

// For API routes. Confirms the caller is signed in and active (getUser() also
// checks the session was not revoked), optionally that their role has
// `permission`, and hands back the admin client.
//   const a = await requireActive("manage_users");
//   if (a.error) return a.error;
//   const { user, profile, admin } = a;
export async function requireActive(permission) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id, display_name, role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.status !== "active") return fail("This account is not active.", 403);
  if (permission && !can(profile.role, permission)) return fail("Not authorized for this action.", 403);

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error(e);
    return fail("The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel and redeploy.", 500);
  }
  return { user, profile, admin };
}
