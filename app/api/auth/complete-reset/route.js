import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isValidEmail, staffIdToAuthEmail } from "../../../../lib/staffAuth";

export async function POST(request) {
  const { email, code, newPassword } = await request.json().catch(() => ({}));

  if (!isValidEmail(email) || !code || String(code).trim().length < 6) {
    return Response.json({ error: "Enter the code from your email." }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  // Throwaway anon-key client, just to check the OTP the same way
  // Supabase's own recovery flow does — no cookies, no shared session.
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    email: normalizedEmail,
    token: String(code).trim(),
    type: "recovery",
  });

  if (verifyError || !verifyData?.user) {
    return Response.json({ error: "That code is invalid or expired." }, { status: 400 });
  }

  const userId = verifyData.user.id;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("staff_id")
    .eq("id", userId)
    .single();

  if (!profile?.staff_id) {
    return Response.json({ error: "Could not find that account." }, { status: 400 });
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (passwordError) {
    return Response.json({ error: "Could not set the new password." }, { status: 500 });
  }

  // Always swap back, even if something above partially failed —
  // the account must never stay parked on the real email.
  await admin.auth.admin.updateUserById(userId, {
    email: staffIdToAuthEmail(profile.staff_id),
    email_confirm: true,
  });

  return Response.json({ ok: true });
}
