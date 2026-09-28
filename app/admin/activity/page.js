import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import RetentionForm from "./RetentionForm";
import { createClient } from "../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../lib/authz";
import { cleanStaffId } from "../../../lib/authRules";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_PAGE = 200;

function fmt(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Muscat",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ActivityPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "view_activity")) redirect("/");

  const staff = cleanStaffId(searchParams?.staff);
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(searchParams?.page, 10) || 1));
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("user_activity")
    .select("id, staff_id, path, at", { count: "exact" })
    .order("at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (staff) query = query.eq("staff_id", staff);
  const { data, count } = await query;
  const rows = data || [];

  const { data: setting } = await supabase
    .from("activity_settings")
    .select("retention_days")
    .eq("id", 1)
    .single();

  // Names for the staff IDs on this page (root can read all profiles).
  const names = {};
  const ids = [...new Set(rows.map((r) => r.staff_id))];
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("staff_id, display_name")
      .in("staff_id", ids);
    for (const p of profiles || []) names[p.staff_id] = p.display_name || "";
  }

  const total = count || 0;
  const hasNext = from + PAGE_SIZE < total && page < MAX_PAGE;
  const href = (n) => {
    const qs = new URLSearchParams();
    if (staff) qs.set("staff", staff);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `/admin/activity?${s}` : "/admin/activity";
  };

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          <Link href="/admin" style={{ color: "var(--color-brand-2)" }}>Admin</Link> / Activity
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>
          Activity log
        </h2>
        <p style={{ margin: "6px 0 16px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          Pages people opened, newest first. Times are Oman time. Refreshing the same page
          within 3 minutes is not logged again.
        </p>

        <div style={{ marginBottom: 16 }}>
          <RetentionForm initialDays={setting?.retention_days ?? 7} />
        </div>

        <form method="get" action="/admin/activity" className="filter-bar">
          <input
            type="search"
            name="staff"
            placeholder="Filter by staff ID"
            defaultValue={staff || ""}
            aria-label="Filter by staff ID"
          />
          <button type="submit" className="btn btn-ghost">Filter</button>
          {staff && (
            <Link href="/admin/activity" className="btn btn-ghost">Clear</Link>
          )}
          <span className="result-count">{total} entries</span>
        </form>

        {rows.length === 0 ? (
          <p style={{ color: "var(--color-ink-muted)" }}>No activity recorded.</p>
        ) : (
          <div className="panel" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--color-ink-muted)" }}>
                  <th style={{ padding: "10px 14px" }}>When</th>
                  <th style={{ padding: "10px 14px" }}>Staff ID</th>
                  <th style={{ padding: "10px 14px" }}>Name</th>
                  <th style={{ padding: "10px 14px" }}>Page</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--color-rule)" }}>
                    <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>{fmt(r.at)}</td>
                    <td className="mono" style={{ padding: "8px 14px" }}>{r.staff_id}</td>
                    <td style={{ padding: "8px 14px" }}>{names[r.staff_id] || ""}</td>
                    <td className="mono" style={{ padding: "8px 14px" }}>{r.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(page > 1 || hasNext) && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {page > 1 && (
              <Link href={href(page - 1)} className="btn btn-ghost">Newer</Link>
            )}
            {hasNext && (
              <Link href={href(page + 1)} className="btn btn-ghost">Older</Link>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
