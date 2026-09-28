import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { passwordProblem } from "../../../../lib/authRules";

// For signed-in users (including those forced to change a temporary
// password). Checks the current password, sets the new one through
// Supabase, then clears the "must change password" flag.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { currentPassword, newPassword } = body || {};

  if (!currentPassword) {
    return Response.json({ error: "Enter your current password." }, { status: 400 });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (newPassword === currentPassword) {
    return Response.json(
      { error: "The new password must be different from the current one." },
      { status: 400 }
    );
  }

  // Verify the current password with a throwaway client, so the real
  // session cookies are left untouched.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return Response.json({ error: "Current password is wrong." }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return Response.json(
      { error: updateError.message || "Could not change the password." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { error: flagError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (flagError) throw flagError;
  } catch (err) {
    console.error("Could not clear must_change_password:", err);
    return Response.json(
      { error: "Password changed, but the account flag could not be cleared. Contact HSE." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
