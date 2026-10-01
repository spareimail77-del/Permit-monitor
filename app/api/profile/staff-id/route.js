import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { cleanStaffId } from "../../../../lib/authRules";
import { isRateLimited } from "../../../../lib/rateLimit";

function fail(error, status) {
  return Response.json({ error }, { status });
}

// POST { newStaffId, reason? }  -> ask for a different Staff ID.
// The account keeps working with the current ID until an admin approves.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.", 401);

  const body = await request.json().catch(() => ({}));
  const newId = cleanStaffId(body.newStaffId);
  const reason = String(body.reason ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  if (!newId) return fail("Enter a valid Staff ID (3-12 letters or numbers).", 400);

  try {
    const admin = createAdminClient();

    const { data: me } = await admin
      .from("profiles")
      .select("staff_id, status")
      .eq("id", user.id)
      .single();
    if (me?.status !== "active") return fail("Account is not active.", 403);
    if (!me.staff_id) return fail("Your account has no Staff ID yet.", 400);
    if (newId === me.staff_id) return fail("That is already your Staff ID.", 400);

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("staff_id", newId)
      .maybeSingle();
    if (taken) return fail("That Staff ID is already used by another account.", 409);

    if (await isRateLimited(admin, `idchange:${user.id}`, 3, 24 * 60)) {
      return fail("Too many requests today. Try again tomorrow.", 429);
    }

    const { error } = await admin.from("staff_id_change_requests").insert({
      user_id: user.id,
      old_staff_id: me.staff_id,
      new_staff_id: newId,
      reason: reason || null,
    });

    if (error) {
      if (error.code === "23505") {
        const mine = /one_open_per_user/.test(error.message || "");
        return fail(
          mine
            ? "You already have a request waiting for approval."
            : "Someone else has already asked for that Staff ID.",
          409
        );
      }
      console.error("ID change request failed:", error.message);
      return fail("Could not send the request. Try again later.", 500);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("ID change request failed:", err);
    return fail("Server error. Try again later.", 500);
  }
}

// DELETE -> withdraw your own open request.
export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.", 401);

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("staff_id_change_requests")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "open");
    if (error) return fail("Could not cancel the request.", 500);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("ID change cancel failed:", err);
    return fail("Server error. Try again later.", 500);
  }
}
