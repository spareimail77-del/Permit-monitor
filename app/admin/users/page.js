import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import UsersList from "./UsersList";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../lib/authz";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "approve_requests")) redirect("/");

  const canManage = hasPermission(access, "manage_users");
  const canReset = hasPermission(access, "reset_passwords");

  // Server-side lookup with the service key (permission checked above).
  // Managers only ever receive the pending requests.
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, staff_id, display_name, role, status, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!canManage) query = query.eq("status", "pending");
  const { data } = await query;

  const nowMs = Date.now();
  const rows = (data || []).map((p) => ({
    id: p.id,
    staffId: p.staff_id || "",
    name: p.display_name || "",
    role: p.role,
    status: p.status,
    createdAt: p.created_at,
    // Minutes since the last page visit (null = never seen). Worked out
    // here on the server; the page does not update by itself.
    seenMin: p.last_seen_at
      ? Math.max(0, Math.floor((nowMs - Date.parse(p.last_seen_at)) / 60000))
      : null,
  }));

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          <Link href="/admin" style={{ color: "var(--color-brand-2)" }}>Admin</Link> / Users
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>
          Users
        </h2>
        <p style={{ margin: "6px 0 20px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          {canManage
            ? "Approve requests, change roles, disable, reset passwords or delete accounts."
            : "Approve or reject account requests."}
        </p>
        <UsersList
          initial={rows}
          meId={user.id}
          canManage={canManage}
          canReset={canReset}
        />
      </section>
    </main>
  );
}
