import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import RetentionForm from "./RetentionForm";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../lib/authz";
import ActivityView from "./ActivityView";

export const dynamic = "force-dynamic";

// One bounded read: the newest rows only (the log keeps at most ~7 days).
const MAX_ROWS = 2000;

export default async function ActivityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "view_activity")) redirect("/");

  // The log tables are locked to Root by the database, so after the
  // permission check above (Root or HSE) the server reads them with the
  // service key. Nothing here can change the log.
  const db = createAdminClient();
  const canManage = hasPermission(access, "manage_activity");

  // Root's own visits are private to Root: anyone else (HSE) never gets
  // those rows, so they can't show up in the list, names, dropdown or
  // summary numbers.
  let query = db
    .from("user_activity")
    .select("staff_id, path, at", { count: "exact" })
    .order("at", { ascending: false })
    .limit(MAX_ROWS);
  if (access.role !== "root") {
    const { data: roots } = await db.from("profiles").select("staff_id").eq("role", "root");
    const rootIds = (roots || []).map((r) => r.staff_id).filter((id) => /^[a-z0-9]{3,12}$/.test(id));
    if (rootIds.length) query = query.not("staff_id", "in", `(${rootIds.join(",")})`);
  }
  const { data, count } = await query;
  const rows = (data || []).map((r) => ({ s: r.staff_id, p: r.path, t: Date.parse(r.at) }));

  const { data: mine } = await db.from("profiles").select("staff_id").eq("id", user.id).single();

  const { data: setting } = await db
    .from("activity_settings")
    .select("retention_days")
    .eq("id", 1)
    .single();

  // Names for the staff IDs on this page (root can read all profiles).
  const names = {};
  const ids = [...new Set(rows.map((r) => r.s))];
  if (ids.length) {
    const { data: profiles } = await db
      .from("profiles")
      .select("staff_id, display_name")
      .in("staff_id", ids);
    for (const p of profiles || []) names[p.staff_id] = p.display_name || "";
  }

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          <Link prefetch={false} href="/admin" style={{ color: "var(--color-brand-2)" }}>Admin</Link> / Activity
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>
          Activity log
        </h2>
        <p style={{ margin: "6px 0 16px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          Visits by the same person less than 30 minutes apart are grouped into one session.
          Click a session to see its pages. Times are Oman time. Refreshing the same page
          within 3 minutes is not logged again.
        </p>

        <div style={{ marginBottom: 16 }}>
          {canManage ? (
            <RetentionForm initialDays={setting?.retention_days ?? 7} />
          ) : (
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" }}>
              The log is kept for {setting?.retention_days ?? 7} days (only Root can change this).
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          <p style={{ color: "var(--color-ink-muted)" }}>No activity recorded.</p>
        ) : (
          <ActivityView rows={rows} names={names} me={mine?.staff_id || null} now={Date.now()} />
        )}
        {(count || 0) > MAX_ROWS && (
          <p style={{ marginTop: 14, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
            Showing the newest {MAX_ROWS} of {count} entries.
          </p>
        )}
      </section>
    </main>
  );
}
