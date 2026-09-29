import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import ArchiveTable from "./ArchiveTable";
import { createClient } from "../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../lib/authz";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ArchivePage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "view_archive")) redirect("/");
  const canDelete = hasPermission(access, "manage_archive");

  // Strip characters that have special meaning inside a PostgREST
  // filter so a search can't break the query.
  const q = (searchParams?.q || "").replace(/[,()%*\\]/g, " ").trim();
  const area = (searchParams?.area || "").trim();
  const type = (searchParams?.type || "").trim();
  const status = (searchParams?.status || "").trim();
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // Distinct filter options. archived_permits is small text columns
  // only, and this app's archive is a single site's permit log, so
  // one bounded scan for the three filter columns is cheap even on
  // the free tier — it does not fetch attachments or grow with page
  // size.
  const { data: optionRows } = await supabase
    .from("archived_permits")
    .select("area, permit_type, excel_status")
    .limit(5000);

  const distinct = (key) =>
    [...new Set((optionRows || []).map((r) => r[key]).filter(Boolean))].sort();
  const areaOptions = distinct("area");
  const typeOptions = distinct("permit_type");
  const statusOptions = distinct("excel_status");

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
  if (area) query = query.eq("area", area);
  if (type) query = query.eq("permit_type", type);
  if (status) query = query.eq("excel_status", status);

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
  const filterParams = {
    ...(q ? { q } : {}),
    ...(area ? { area } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };
  const pageHref = (n) =>
    `/admin/archive?${new URLSearchParams({ ...filterParams, page: String(n) })}`;
  const hasActiveFilters = !!(q || area || type || status);

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
          {canDelete && " Select rows to permanently delete a permit and any attachments filed under it."}
        </p>

        <form method="get" style={styles.filterForm}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search permit no., job, holder or area"
            style={{ ...styles.input, flex: "1 1 240px" }}
          />
          <select name="area" defaultValue={area} style={styles.select}>
            <option value="">All areas</option>
            {areaOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select name="type" defaultValue={type} style={styles.select}>
            <option value="">All types</option>
            {typeOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select name="status" defaultValue={status} style={styles.select}>
            <option value="">All statuses</option>
            {statusOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary">Filter</button>
          {hasActiveFilters && (
            <Link href="/admin/archive" className="btn btn-ghost">Clear</Link>
          )}
        </form>

        {error && <p className="error-text">Could not load the archive.</p>}

        {!error && list.length === 0 && (
          <p style={styles.empty}>
            {hasActiveFilters ? "No archived permits match your filters." : "Nothing archived yet."}
          </p>
        )}

        {list.length > 0 && (
          <ArchiveTable rows={list} attachmentsByRef={attachmentsByRef} canDelete={canDelete} />
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
  filterForm: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" },
  input: {
    padding: "9px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-rule)",
    background: "var(--color-surface)",
    color: "var(--color-ink)",
    fontFamily: "inherit",
    fontSize: "var(--font-size-sm)",
  },
  select: {
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
