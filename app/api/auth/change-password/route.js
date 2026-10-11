import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../../../lib/supabase/server";
import { passwordProblem } from "../../../../lib/authRules";
import { createAdminClient } from "../../../../lib/supabase/admin";

// Checks the current password, then sets the new one through Supabase.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { currentPassword, newPassword } = body || {};

  if (!currentPassword) return Response.json({ error: "Enter your current password." }, { status: 400 });
  const problem = passwordProblem(newPassword);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (newPassword === currentPassword) {
    return Response.json({ error: "The new password must be different from the current one." }, { status: 400 });
  }

  // Check the current password with a throwaway client, so the real session
  // cookies are left alone.
  const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return Response.json({ error: "Current password is wrong." }, { status: 400 });

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return Response.json({ error: updateError.message || "Could not change the password." }, { status: 400 });
  }

  // A temporary password has been replaced: lift the "must change" lock. Done by
  // the server (the person cannot lift it themselves).
  try {
    const { error } = await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
    if (error) throw error;
  } catch (e) {
    console.error("Clearing must_change_password failed:", e);
    return Response.json(
      { error: "Password changed, but the account could not be unlocked. Tell Root (check SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }
  return Response.json({ ok: true });
}
