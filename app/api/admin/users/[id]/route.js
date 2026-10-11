import { requireActive } from "../../../../../lib/adminAuth";
import { ALL_ROLES } from "../../../../../lib/permissions";
import { resetPasswordFor } from "../../../../../lib/accountActions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LAST_ROOT = "There must always be at least one active Root. Make someone else Root first.";

const bad = (error, status = 400) => Response.json({ error }, { status });

async function otherActiveRoots(admin, id) {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "root")
    .eq("status", "active")
    .neq("id", id);
  return count ?? 0;
}

function dbProblem(error) {
  if (/last active Root/i.test(error?.message || "")) return bad(LAST_ROOT, 409);
  console.error("Updating a profile failed:", error);
  return bad("The change could not be saved.", 500);
}

// Root only (middleware checks the URL, and requireActive checks again).
// Body: { action: "approve" | "set_role" | "disable" | "enable" | "reset_password", role? }
export async function PATCH(request, { params }) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { admin, user } = a;

  const id = params.id;
  if (!UUID.test(id)) return bad("Unknown account.", 404);
  const body = await request.json().catch(() => null);
  const action = body?.action;

  const { data: target } = await admin.from("profiles").select("id, staff_id, role, status").eq("id", id).maybeSingle();
  if (!target) return bad("Unknown account.", 404);

  const isSelf = id === user.id;
  const isActiveRoot = target.role === "root" && target.status === "active";
  const role = body?.role;
  if (role !== undefined && !ALL_ROLES.includes(role)) return bad("Unknown role.");

  async function save(patch) {
    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    return error ? dbProblem(error) : Response.json({ ok: true });
  }

  if (action === "approve") {
    if (target.status !== "pending") return bad("This account is not waiting for approval.", 409);
    return save({ status: "active", ...(role ? { role } : {}) });
  }

  if (action === "set_role") {
    if (!role) return bad("Choose a role.");
    if (isSelf) return bad("You cannot change your own role.", 403);
    if (target.status === "pending") return bad("Approve the account first.", 409);
    if (isActiveRoot && role !== "root" && (await otherActiveRoots(admin, id)) === 0) return bad(LAST_ROOT, 409);
    return save({ role });
  }

  if (action === "disable") {
    if (isSelf) return bad("You cannot disable your own account.", 403);
    if (target.status !== "active") return bad("Only an active account can be disabled.", 409);
    if (isActiveRoot && (await otherActiveRoots(admin, id)) === 0) return bad(LAST_ROOT, 409);
    return save({ status: "disabled" });
  }

  if (action === "enable") {
    if (target.status !== "disabled") return bad("This account is not disabled.", 409);
    return save({ status: "active" });
  }

  if (action === "reset_password") {
    const result = await resetPasswordFor(admin, id);
    if (result.error) return bad(result.error, 500);
    // Any open "forgot password" request from this person is now answered.
    await admin
      .from("password_reset_requests")
      .update({ status: "done", resolved_by: a.profile.staff_id, resolved_at: new Date().toISOString() })
      .eq("staff_id", target.staff_id)
      .eq("status", "open");
    return Response.json({ ok: true, staffId: target.staff_id, tempPassword: result.tempPassword });
  }

  return bad("Unknown action.");
}

// Removes the account completely (also how a pending request is rejected).
export async function DELETE(request, { params }) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { admin, user } = a;

  const id = params.id;
  if (!UUID.test(id)) return bad("Unknown account.", 404);
  if (id === user.id) return bad("You cannot delete your own account.", 403);

  const { data: target } = await admin.from("profiles").select("id, staff_id, role, status").eq("id", id).maybeSingle();
  if (!target) return bad("Unknown account.", 404);
  if (target.role === "root" && target.status === "active" && (await otherActiveRoots(admin, id)) === 0) {
    return bad(LAST_ROOT, 409);
  }

  const { error } = await admin.auth.admin.deleteUser(id); // the profile goes with it
  if (error) {
    console.error("Deleting an account failed:", error);
    return bad(/last active Root/i.test(error.message || "") ? LAST_ROOT : "The account could not be deleted.", 500);
  }
  await admin.from("password_reset_requests").delete().eq("staff_id", target.staff_id);
  return Response.json({ ok: true });
}
