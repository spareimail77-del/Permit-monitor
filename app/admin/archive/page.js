import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ArchivePage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/");

  // Strip characters that have special meaning inside a PostgREST
  // filter so a search can't break the query.
  const q = (searchParams?.q || "").replace(/[,()%*\\]/g, " ").trim();
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("archived_permits")
    .select(
      "id, reference, area, permit_type, job_description, holder, valid_to, excel_status, archived_at",
      { count: "exact" }
    )
    .order("archived_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (q) {
    query = query.or(
      `reference.ilike.%${q}%,job_description.ilike.%${q}%,holder.ilike.%${q}%,area.ilike.%${q}%`
    );
  }

  const { data: rows, count, error } = await query;
  const list = rows || [];

  // Attachments stay linked to the permit number, so archived permits
  // keep their scans. One query for just this page's permit numbers.
  let attachmentsByRef = {};
  if (list.length) {
    const { data: atts } = await supabase
      .from("permit_attachments")
      .select("id, permit_reference, label, file_name")
      .in("permit_reference", list.map((r) => r.reference));
    for (const a of atts || []) {
      (attachmentsByRef[a.permit_reference] ||= []).push(a);
    }
  }

  const total = count || 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n) =>
    `/admin/archive?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <p style={styles.crumb}>
          <Link href="/admin" style={styles.crumbLink}>Admin</Link> / Archive
        </p>
        <h2 style={styles.heading}>Permit Archive</h2>
        <p style={styles.subheading}>
          Permits that were removed from the Excel file. {total} archived.
        </p>

        <form method="get" style={styles.searchForm}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search permit no., job, holder or area"
            style={styles.input}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        {error && <p className="error-text">Could not load the archive.</p>}

        {!error && list.length === 0 && (
          <p style={styles.empty}>
            {q ? "No archived permits match your search." : "Nothing archived yet."}
          </p>
        )}

        {list.length > 0 && (
          <div className="table-scroll panel">
            <table className="permit-table">
              <thead>
                <tr>
                  <th>Permit No.</th>
                  <th>Area</th>
                  <th>Type</th>
                  <th>Job</th>
                  <th>Holder</th>
                  <th>Valid to</th>
                  <th>Last status</th>
                  <th>Archived</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.reference}</td>
                    <td>{r.area}</td>
                    <td>{r.permit_type}</td>
                    <td>{r.job_description}</td>
                    <td>{r.holder}</td>
                    <td className="mono">{r.valid_to}</td>
                    <td>{r.excel_status}</td>
                    <td className="mono">
                      {new Date(r.archived_at).toLocaleDateString("en-GB")}
                    </td>
                    <td>
                      {(attachmentsByRef[r.reference] || []).map((a) => (
                        <div key={a.id}>
                          <a
                            href={`/api/attachments/${a.id}/view`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.label}
                          </a>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastPage > 1 && (
          <div style={styles.pager}>
            {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-ghost">Previous</Link>}
            <span style={styles.pageInfo}>Page {page} of {lastPage}</span>
            {page < lastPage && <Link href={pageHref(page + 1)} className="btn btn-ghost">Next</Link>}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  main: { minHeight: "100svh" },
  body: { maxWidth: 1120, margin: "0 auto", padding: "32px 20px" },
  crumb: { margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" },
  crumbLink: { color: "var(--color-brand-2)" },
  heading: { margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" },
  subheading: { margin: "6px 0 20px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" },
  searchForm: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  input: {
    flex: "1 1 240px",
    padding: "9px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-rule)",
    background: "var(--color-surface)",
    color: "var(--color-ink)",
    fontFamily: "inherit",
    fontSize: "var(--font-size-sm)",
  },
  empty: { color: "var(--color-ink-muted)" },
  pager: { display: "flex", gap: 12, alignItems: "center", marginTop: 16 },
  pageInfo: { fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" },
};
