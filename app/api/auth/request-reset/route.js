import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isValidEmail } from "../../../../lib/staffAuth";

// Generic message either way — never reveals whether an email is
// registered.
const GENERIC_OK = { message: "If that email is registered, a code has been sent." };

export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));

  if (!isValidEmail(email)) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, staff_id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (!profile?.id) {
    return Response.json(GENERIC_OK);
  }

  // Point the account's login email at the real address just long
  // enough for Supabase's own mailer to deliver the reset email to
  // it — the account is otherwise permanently on the synthetic
  // staff-ID address. Self-heals: /api/auth/complete-reset swaps it
  // back on success, and a fresh request-reset call safely re-does
  // this swap if a previous attempt was abandoned.
  const { error: swapError } = await admin.auth.admin.updateUserById(profile.id, {
    email: normalizedEmail,
    email_confirm: true,
  });
  if (swapError) {
    return Response.json({ error: "Could not start the reset right now." }, { status: 500 });
  }

  // A throwaway anon-key client (no cookies, no shared session) just
  // to trigger Supabase's built-in "Reset Password" email template.
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await anon.auth.resetPasswordForEmail(normalizedEmail);

  return Response.json(GENERIC_OK);
}
