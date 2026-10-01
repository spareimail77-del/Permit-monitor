import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import IdChangesList from "./IdChangesList";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../lib/authz";

export const dynamic = "force-dynamic";

export default async function IdChangesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "approve_requests")) redirect("/");
  const isRoot = hasPermission(access, "manage_users");

  // Server-side lookup with the service key (permission checked above).
  const admin = createAdminClient();
  let problem = false;
  let open = [];
  let decided = [];
  try {
    const { data, error } = await admin
      .from("staff_id_change_requests")
      .select(
        "id, user_id, old_staff_id, new_staff_id, reason, status, decision_note, requested_at, decided_at, decided_by"
      )
      .order("requested_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = data || [];
    const ids = [...new Set(rows.flatMap((r) => [r.user_id, r.decided_by]).filter(Boolean))];
    const names = {};
    if (ids.length) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, staff_id, display_name")
        .in("id", ids);
      for (const p of profiles || []) names[p.id] = p.display_name || p.staff_id || "";
    }

    const shape = (r) => ({
      id: r.id,
      name: names[r.user_id] || "",
      isMe: r.user_id === user.id,
      oldStaffId: r.old_staff_id,
      newStaffId: r.new_staff_id,
      reason: r.reason || "",
      status: r.status,
      note: r.decision_note || "",
      requestedAt: r.requested_at,
      decidedAt: r.decided_at,
      decidedBy: r.decided_by ? names[r.decided_by] || "" : "",
    });
    open = rows.filter((r) => r.status === "open").reverse().map(shape); // oldest first
    decided = rows.filter((r) => r.status !== "open").slice(0, 30).map(shape);
  } catch (err) {
    problem = true;
  }

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px" }}>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          <Link prefetch={false} href="/admin" style={{ color: "var(--color-brand-2)" }}>Admin</Link> / Staff ID changes
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>
          Staff ID changes
        </h2>
        <p style={{ margin: "6px 0 20px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          Approving switches the person&apos;s login to the new ID and moves their activity and upload history with
          them. Their attachments and archived permits follow automatically.
        </p>

        {problem ? (
          <p className="notice">
            The requests could not be read. Run <span className="mono">step35-profile-and-upload-log.sql</span> in
            Supabase (SQL Editor) once, then reload this page.
          </p>
        ) : (
          <IdChangesList initialOpen={open} decided={decided} canDecideOwn={isRoot} />
        )}
      </section>
    </main>
  );
}
