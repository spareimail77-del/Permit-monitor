// What is waiting for Root: { pendingUsers, passwordRequests, idChanges }.
export async function getAdminCounts(admin) {
  const head = { count: "exact", head: true };
  const [u, p, i] = await Promise.all([
    admin.from("profiles").select("id", head).eq("status", "pending"),
    admin.from("password_reset_requests").select("id", head).eq("status", "open"),
    admin.from("staff_id_change_requests").select("id", head).eq("status", "open"),
  ]);
  return { pendingUsers: u.count ?? 0, passwordRequests: p.count ?? 0, idChanges: i.count ?? 0 };
}
