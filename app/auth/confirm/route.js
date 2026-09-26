import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { staffIdToAuthEmail } from "../../../lib/staffAuth";

export const dynamic = "force-dynamic";

function redirectTo(request, path) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = path;
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = createClient();

  // @supabase/ssr's browser client defaults to the PKCE flow, so the
  // confirmation link normally carries `?code=`. `token_hash`/`type`
  // is handled too, in case a template or Supabase config sends the
  // older link shape instead.
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: null, error: new Error("Missing confirmation code.") };

  if (error || !data?.user) {
    return redirectTo(request, "?error=confirm_failed");
  }

  const userId = data.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id")
    .eq("id", userId)
    .single();

  if (!profile?.staff_id) {
    return redirectTo(request, "?error=confirm_failed");
  }

  try {
    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      email: staffIdToAuthEmail(profile.staff_id),
      email_confirm: true,
    });
    if (updateError) throw updateError;
  } catch (err) {
    return redirectTo(request, "?error=confirm_failed");
  }

  // The session's JWT still carries the old (real) email — safest to
  // drop it and have them sign in fresh with staff ID + password.
  await supabase.auth.signOut();

  return redirectTo(request, "?confirmed=1");
}
