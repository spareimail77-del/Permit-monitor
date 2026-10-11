import { requireActive } from "../../../../lib/adminAuth";
import { cleanStaffId } from "../../../../lib/authRules";

const bad = (error, status = 400) => Response.json({ error }, { status });

// A signed-in person asks to change their Staff ID, or cancels that request.
// Body: { action: "request", newStaffId, reason? } or { action: "cancel" }
// Root decides in Admin -> Staff ID changes.
export async function POST(request) {
  const a = await requireActive(); // any active account
  if (a.error) return a.error;
  const { admin, user, profile } = a;

  const body = await request.json().catch(() => null);

  if (body?.action === "cancel") {
    const { error } = await admin
      .from("staff_id_change_requests")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "open");
    if (error) return bad("Could not cancel.", 500);
    return Response.json({ ok: true });
  }

  if (body?.action !== "request") return bad("Unknown action.");

  const newId = cleanStaffId(body.newStaffId);
  if (!newId) return bad("The new Staff ID must be 3 to 12 letters or digits.");
  if (newId === profile.staff_id) return bad("That is already your Staff ID.");
  const reason = String(body.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

  const { count: open } = await admin
    .from("staff_id_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "open");
  if ((open ?? 0) > 0) return bad("You already have a request waiting. Cancel it first.", 409);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: today } = await admin
    .from("staff_id_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((today ?? 0) >= 3) return bad("You have made 3 requests in the last day. Try again tomorrow.", 429);

  const { data: used } = await admin.from("profiles").select("id").eq("staff_id", newId).maybeSingle();
  if (used) return bad("That Staff ID is already used by another account.", 409);

  const { error } = await admin
    .from("staff_id_change_requests")
    .insert({ user_id: user.id, old_staff_id: profile.staff_id, new_staff_id: newId, reason });
  if (error) {
    if (error.code === "23505") return bad("Someone else has already asked for that Staff ID.", 409);
    console.error("Saving a Staff ID request failed:", error);
    return bad("The request could not be saved.", 500);
  }
  return Response.json({ ok: true });
}
