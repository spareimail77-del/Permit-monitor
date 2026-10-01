import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../../../lib/authz";
import { staffIdToAuthEmail } from "../../../../../lib/staffAuth";

// Body: { action: "approve" | "reject", note? }
// Root and Manager (permission approve_requests; middleware checks it and this
// route checks it again).
//
// Approve = three steps that are undone if a later one fails:
//   1. the login address (<id>@staff.permit-log.internal) is switched to the
//      new ID through Supabase's admin API;
//   2. apply_staff_id_change() (SQL, all-or-nothing) updates the profile and
//      rewrites the old ID in the activity log, password requests and upload
//      log, and marks the request approved;
//   3. if step 2 fails, the login address is switched back.
// Attachments and archived permits point to the account's internal id, so
// they follow the person without any change.
function fail(error, status) {
  return Response.json({ error }, { status });
}

const SAFE_DB_MESSAGES = [
  "Request not found or already handled",
  "That account no longer exists",
  "The Staff ID changed since this request was made",
  "That Staff ID is already used by another account",
];

export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.", 401);

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "approve_requests")) {
    return fail("You do not have permission to do that.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : null;
  if (!action) return fail("Unknown action.", 400);

  const id = String(params.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid request.", 400);

  try {
    const admin = createAdminClient();

    const { data: req } = await admin
      .from("staff_id_change_requests")
      .select("id, user_id, old_staff_id, new_staff_id, status")
      .eq("id", id)
      .single();
    if (!req || req.status !== "open") {
      return fail("Request not found or already handled.", 404);
    }

    // Deciding your own request is only allowed for Root.
    if (req.user_id === user.id && !hasPermission(access, "manage_users")) {
      return fail("Another admin has to decide your own request.", 403);
    }

    if (action === "reject") {
      const note = String(body.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      const { error } = await admin
        .from("staff_id_change_requests")
        .update({
          status: "rejected",
          decision_note: note || null,
          decided_at: new Date().toISOString(),
          decided_by: user.id,
        })
        .eq("id", req.id)
        .eq("status", "open");
      if (error) return fail("Could not reject the request.", 500);
      return Response.json({ ok: true });
    }

    // ---- approve ----
    const { data: current } = await admin
      .from("profiles")
      .select("staff_id")
      .eq("id", req.user_id)
      .single();
    if (!current) return fail("That account no longer exists.", 404);
    if (current.staff_id !== req.old_staff_id) {
      return fail("The Staff ID changed since this request was made.", 409);
    }

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("staff_id", req.new_staff_id)
      .maybeSingle();
    if (taken) return fail("That Staff ID is now used by another account.", 409);

    const oldEmail = staffIdToAuthEmail(req.old_staff_id);
    const newEmail = staffIdToAuthEmail(req.new_staff_id);

    // 1. login address
    const { error: emailError } = await admin.auth.admin.updateUserById(req.user_id, {
      email: newEmail,
      email_confirm: true,
    });
    if (emailError) {
      console.error("ID change: login address update failed:", emailError.message);
      const exists = /already|registered|exists/i.test(emailError.message || "");
      return fail(
        exists
          ? "That Staff ID is already used by a login."
          : "Could not change the login. Nothing was changed.",
        exists ? 409 : 500
      );
    }

    // 2. profile + history, all or nothing
    const { error: applyError } = await admin.rpc("apply_staff_id_change", {
      p_request_id: req.id,
      p_decided_by: user.id,
    });

    if (applyError) {
      console.error("ID change: database step failed:", applyError.message);
      // 3. put the login address back
      const { error: revertError } = await admin.auth.admin.updateUserById(req.user_id, {
        email: oldEmail,
        email_confirm: true,
      });
      if (revertError) {
        console.error(
          "ID change: COULD NOT RESTORE login address for",
          req.old_staff_id,
          revertError.message
        );
      }
      const known = SAFE_DB_MESSAGES.find((m) => (applyError.message || "").includes(m));
      return fail(known ? `${known}.` : "Could not apply the change. Nothing was changed.", known ? 409 : 500);
    }

    return Response.json({ ok: true, newStaffId: req.new_staff_id });
  } catch (err) {
    console.error("ID change decision failed:", err);
    return fail("Server error.", 500);
  }
}
