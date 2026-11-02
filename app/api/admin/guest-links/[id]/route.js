import { requireActive } from "../../../../../lib/adminAuth";

// Root only. PATCH { action: "revoke" } cancels a link and ends its guest session at once.
// DELETE removes the row (and the guest account, if any) from the list.
async function load(admin, id) {
  const { data } = await admin.from("guest_links").select("id, opened_at, guest_user_id, revoked_at").eq("id", id).maybeSingle();
  return data;
}

export async function PATCH(request, { params }) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { admin } = a;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown link." }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (body?.action !== "revoke") return Response.json({ error: "Unknown action." }, { status: 400 });

  const link = await load(admin, id);
  if (!link) return Response.json({ error: "Link not found." }, { status: 404 });

  const now = new Date().toISOString();
  if (!link.revoked_at) {
    const { error } = await admin.from("guest_links").update({ revoked_at: now }).eq("id", id);
    if (error) {
      console.error("Revoking a guest link failed:", error);
      return Response.json({ error: "Could not cancel the link. Please try again." }, { status: 500 });
    }
  }
  // End a running guest session now: the account is disabled and its time set to now.
  if (link.guest_user_id) {
    await admin.from("profiles").update({ status: "disabled", guest_expires_at: now }).eq("id", link.guest_user_id);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { admin } = a;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown link." }, { status: 400 });

  const link = await load(admin, id);
  if (!link) return Response.json({ error: "Link not found." }, { status: 404 });
  if (link.guest_user_id) await admin.auth.admin.deleteUser(link.guest_user_id).catch(() => {});
  const { error } = await admin.from("guest_links").delete().eq("id", id);
  if (error) {
    console.error("Removing a guest link failed:", error);
    return Response.json({ error: "Could not remove it. Please try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
