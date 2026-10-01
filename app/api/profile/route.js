import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { cleanName } from "../../../lib/authRules";

// PATCH { displayName }  -> the signed-in person corrects their own name.
// Nothing else about the account can be changed here (role, status and
// Staff ID are not accepted); a Staff ID change goes through a request that
// an admin approves (see ./staff-id/route.js).
export async function PATCH(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.displayName);
  if (!name) {
    return Response.json({ error: "Enter your name (2-40 characters)." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    if (profile?.status !== "active") {
      return Response.json({ error: "Account is not active." }, { status: 403 });
    }

    const { error } = await admin
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);
    if (error) {
      console.error("Name update failed:", error.message);
      return Response.json({ error: "Could not save your name." }, { status: 500 });
    }
    return Response.json({ ok: true, displayName: name });
  } catch (err) {
    console.error("Profile update failed:", err);
    return Response.json({ error: "Server error. Try again later." }, { status: 500 });
  }
}
