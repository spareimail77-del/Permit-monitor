import { requireActive } from "../../../../../lib/adminAuth";
import { staffIdToAuthEmail } from "../../../../../lib/staffAuth";

const bad = (error, status = 400) => Response.json({ error }, { status });

// Body: { action: "approve" | "reject", note? }
export async function POST(request, { params }) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { admin, profile: me } = a;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return bad("Unknown request.", 404);
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const note = String(body?.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

  const { data: req } = await admin
    .from("staff_id_change_requests")
    .select("id, user_id, old_staff_id, new_staff_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!req) return bad("Unknown request.", 404);
  if (req.status !== "open") return bad("This request has already been decided.", 409);

  const decide = (status) =>
    admin
      .from("staff_id_change_requests")
      .update({ status, decision_note: note, decided_by: me.staff_id, decided_at: new Date().toISOString() })
      .eq("id", id);

  if (action === "reject") {
    const { error } = await decide("rejected");
    if (error) return bad("Could not save.", 500);
    return Response.json({ ok: true });
  }

  if (action !== "approve") return bad("Unknown action.");

  const { data: owner } = await admin.from("profiles").select("id, staff_id").eq("id", req.user_id).maybeSingle();
  if (!owner) return bad("That account no longer exists. Reject the request.", 404);
  if (owner.staff_id !== req.old_staff_id) return bad("The person's Staff ID has changed since this request. Reject it.", 409);

  const { data: clash } = await admin.from("profiles").select("id").eq("staff_id", req.new_staff_id).maybeSingle();
  if (clash) return bad(`Staff ID ${req.new_staff_id} is already used by another account. Reject the request.`, 409);

  // 1) the sign-in address, 2) the profile. If step 2 fails, step 1 is undone.
  const oldEmail = staffIdToAuthEmail(req.old_staff_id);
  const newEmail = staffIdToAuthEmail(req.new_staff_id);

  const first = await admin.auth.admin.updateUserById(req.user_id, { email: newEmail, email_confirm: true });
  if (first.error) {
    console.error("Changing the sign-in address failed:", first.error);
    return bad("The sign-in address could not be changed.", 500);
  }

  const second = await admin.from("profiles").update({ staff_id: req.new_staff_id }).eq("id", req.user_id);
  if (second.error) {
    console.error("Changing the profile Staff ID failed:", second.error);
    const undo = await admin.auth.admin.updateUserById(req.user_id, { email: oldEmail, email_confirm: true });
    if (undo.error) console.error("UNDO FAILED: sign-in address is now", newEmail, "but profile still", req.old_staff_id, undo.error);
    return bad("The Staff ID could not be changed. Nothing was changed.", 500);
  }

  // Keep an open password request attached to the right person.
  await admin
    .from("password_reset_requests")
    .update({ staff_id: req.new_staff_id })
    .eq("staff_id", req.old_staff_id)
    .eq("status", "open");

  const { error } = await decide("approved");
  if (error) console.error("Staff ID changed but the request could not be marked approved:", error);
  return Response.json({ ok: true });
}
