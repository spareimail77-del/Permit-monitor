import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../../../lib/authz";
import { generateTempPassword } from "../../../../../lib/tempPassword";

// Body: { action: "reset" } sets a temporary password and forces a change
// at next login; { action: "dismiss" } closes the request without a reset.
export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "reset_passwords")) {
    return Response.json(
      { error: "You do not have permission to reset passwords." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "dismiss" ? "dismiss" : "reset";

  try {
    const admin = createAdminClient();

    const { data: req } = await admin
      .from("password_reset_requests")
      .select("id, staff_id, status")
      .eq("id", params.id)
      .single();
    if (!req || req.status !== "open") {
      return Response.json({ error: "Request not found or already handled." }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "dismiss") {
      await admin
        .from("password_reset_requests")
        .update({ status: "dismissed", resolved_at: now, resolved_by: user.id })
        .eq("id", req.id);
      return Response.json({ ok: true });
    }

    const { data: target } = await admin
      .from("profiles")
      .select("id")
      .eq("staff_id", req.staff_id)
      .single();
    if (!target) {
      return Response.json({ error: "That account no longer exists." }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    const { error: pwError } = await admin.auth.admin.updateUserById(target.id, {
      password: tempPassword,
    });
    if (pwError) {
      console.error("Password reset failed:", pwError);
      return Response.json({ error: "Could not set the temporary password." }, { status: 500 });
    }

    await admin.from("profiles").update({ must_change_password: true }).eq("id", target.id);
    await admin
      .from("password_reset_requests")
      .update({ status: "done", resolved_at: now, resolved_by: user.id })
      .eq("id", req.id);

    return Response.json({ ok: true, staffId: req.staff_id, tempPassword });
  } catch (err) {
    console.error("Password request failed:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
