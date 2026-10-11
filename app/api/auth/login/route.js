import { createClient } from "../../../../lib/supabase/server";
import { staffIdToAuthEmail } from "../../../../lib/staffAuth";
import { cleanStaffId } from "../../../../lib/authRules";

// Sign in with Staff ID and password. The session is stored in cookies by the
// server client, so the browser never handles the tokens.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const staffId = cleanStaffId(body?.staffId);
  const password = String(body?.password ?? "");

  // One message for every wrong sign-in, so it never says which part was wrong.
  const wrong = () => Response.json({ error: "Wrong Staff ID or password." }, { status: 401 });
  if (!staffId || !password) return wrong();

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: staffIdToAuthEmail(staffId),
    password,
  });
  if (error || !data?.user) return wrong();

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    const reason = profile?.status === "disabled" ? "disabled" : "pending";
    return Response.json(
      {
        error:
          reason === "disabled"
            ? "This account has been disabled. Please contact Root."
            : "This account is waiting for approval. Please contact Root.",
      },
      { status: 403 }
    );
  }

  return Response.json({ ok: true });
}
