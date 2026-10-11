import { requireActive } from "../../../../../lib/adminAuth";
import { resetPasswordFor } from "../../../../../lib/accountActions";

const bad = (error, status = 400) => Response.json({ error }, { status });

// Body: { action: "reset" | "dismiss" }
// "reset" gives the person a temporary password, returned ONCE in this answer.
export async function POST(request, { params }) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { admin, profile: me } = a;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return bad("Unknown request.", 404);
  const body = await request.json().catch(() => null);
  const action = body?.action;

  const { data: req } = await admin
    .from("password_reset_requests")
    .select("id, staff_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!req) return bad("Unknown request.", 404);
  if (req.status !== "open") return bad("This request has already been handled.", 409);

  const resolve = (status) =>
    admin
      .from("password_reset_requests")
      .update({ status, resolved_by: me.staff_id, resolved_at: new Date().toISOString() })
      .eq("id", id);

  if (action === "dismiss") {
    const { error } = await resolve("dismissed");
    if (error) return bad("Could not save.", 500);
    return Response.json({ ok: true });
  }

  if (action === "reset") {
    const { data: target } = await admin.from("profiles").select("id").eq("staff_id", req.staff_id).maybeSingle();
    if (!target) return bad("No account has that Staff ID any more. Dismiss the request.", 404);

    const result = await resetPasswordFor(admin, target.id);
    if (result.error) return bad(result.error, 500);
    await resolve("done");
    return Response.json({ ok: true, staffId: req.staff_id, tempPassword: result.tempPassword });
  }

  return bad("Unknown action.");
}
