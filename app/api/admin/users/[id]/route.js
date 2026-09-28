import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../../../lib/authz";
import { ALL_ROLES } from "../../../../../lib/permissions";
import { generateTempPassword } from "../../../../../lib/tempPassword";

// Body: { action, role? }
//   approve        pending -> active   (Root, Manager)
//   reject         pending -> removed  (Root, Manager)
//   setRole        change role         (Root)
//   disable/enable block / unblock     (Root)
//   resetPassword  temporary password  (Root)
//   delete         remove the account  (Root)
// Middleware already lets Root and Manager reach this URL; every action
// below checks its own permission again, and the last-root and
// "not yourself" rules are enforced here, on the server.
const NEEDS = {
  approve: "approve_requests",
  reject: "approve_requests",
  setRole: "manage_users",
  disable: "manage_users",
  enable: "manage_users",
  resetPassword: "reset_passwords",
  delete: "manage_users",
};

function fail(error, status) {
  return Response.json({ error }, { status });
}

export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.", 401);

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const needed = NEEDS[action];
  if (!needed) return fail("Unknown action.", 400);

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, needed)) {
    return fail("You do not have permission to do that.", 403);
  }

  const targetId = String(params.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) return fail("Invalid user.", 400);

  // Nobody changes their own role/status or deletes themselves here
  // (a password change has its own page in the user menu).
  if (targetId === user.id) {
    return fail("You cannot do that to your own account.", 400);
  }

  try {
    const admin = createAdminClient();

    const { data: target } = await admin
      .from("profiles")
      .select("id, staff_id, role, status")
      .eq("id", targetId)
      .single();
    if (!target) return fail("That account no longer exists.", 404);

    // Approve/reject only ever apply to pending requests.
    if ((action === "approve" || action === "reject") && target.status !== "pending") {
      return fail("That request has already been handled.", 409);
    }

    // The last active root can never be demoted, disabled or deleted.
    const removesRoot =
      target.role === "root" &&
      target.status === "active" &&
      (action === "disable" ||
        action === "delete" ||
        (action === "setRole" && body.role !== "root"));
    if (removesRoot) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "root")
        .eq("status", "active")
        .neq("id", target.id);
      if (!count) return fail("There must always be at least one active Root account.", 409);
    }

    switch (action) {
      case "approve": {
        const { error } = await admin
          .from("profiles")
          .update({ status: "active" })
          .eq("id", target.id);
        if (error) throw error;
        return Response.json({ ok: true, status: "active" });
      }

      case "reject":
      case "delete": {
        // Deleting the login also removes the profile (cascade).
        const { error } = await admin.auth.admin.deleteUser(target.id);
        if (error) throw error;
        return Response.json({ ok: true, removed: true });
      }

      case "setRole": {
        if (!ALL_ROLES.includes(body.role)) return fail("Unknown role.", 400);
        if (target.status === "pending") return fail("Approve the account first.", 409);
        const { error } = await admin
          .from("profiles")
          .update({ role: body.role })
          .eq("id", target.id);
        if (error) throw error;
        return Response.json({ ok: true, role: body.role });
      }

      case "disable":
      case "enable": {
        if (target.status === "pending") return fail("Approve the account first.", 409);
        const status = action === "disable" ? "disabled" : "active";
        const { error } = await admin
          .from("profiles")
          .update({ status })
          .eq("id", target.id);
        if (error) throw error;
        return Response.json({ ok: true, status });
      }

      case "resetPassword": {
        if (target.status === "pending") return fail("Approve the account first.", 409);
        const tempPassword = generateTempPassword();
        const { error: pwError } = await admin.auth.admin.updateUserById(target.id, {
          password: tempPassword,
        });
        if (pwError) throw pwError;
        const { error: flagError } = await admin
          .from("profiles")
          .update({ must_change_password: true })
          .eq("id", target.id);
        if (flagError) throw flagError;
        // Close any open forgot-password request for this person.
        await admin
          .from("password_reset_requests")
          .update({
            status: "done",
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          })
          .eq("staff_id", target.staff_id)
          .eq("status", "open");
        return Response.json({ ok: true, staffId: target.staff_id, tempPassword });
      }
    }
    return fail("Unknown action.", 400);
  } catch (err) {
    console.error("User management failed:", err);
    return fail("Server error.", 500);
  }
}
