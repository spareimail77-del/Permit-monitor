import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import Icon from "../../components/Icon";
import ArchiveTable from "./ArchiveTable";
import { createClient } from "../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../lib/authz";
import { todayInMuscat } from "../../../lib/status";
import {
  ARCHIVE_SORTS,
  applyArchiveFilters,
  applyArchiveSort,
  archivePresets,
  filtersToParams,
  hasActiveFilters,
  parseArchiveFilters,
  parseSort,
} from "../../../lib/archiveFilters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const CHIP_LABELS = {
  q: "Search",
  area: "Area",
  type: "Type",
  status: "Status",
  from: "Archived from",
  to: "Archived to",
  vfrom: "Valid to from",
  vto: "Valid to until",
};

export default async function ArchivePage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "view_archive")) redirect("/");
  const canDelete = hasPermission(access, "manage_archive");
  const canExport = hasPermission(access, "export_data");

  const filters = parseArchiveFilters(searchParams || {});
  const sort = parseSort(searchParams?.sort);
  const filtersActive = hasActiveFilters(filters);
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const today = todayInMuscat();

  // Distinct filter options. archived_permits is small text columns
  // only, and this app's archive is a single site's permit log, so
  // one bounded scan for the three filter columns is cheap even on
  // the free tier.
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
    .range(from, from + PAGE_SIZE - 1);
  query = applyArchiveFilters(query, filters);
  query = applyArchiveSort(query, sort);

  const { data: rows, count, error } = await query;
  const list = rows || [];

  // Whole-archive size, only needed to say "38 of 212" when filtered.
  let archiveTotal = count || 0;
  if (filtersActive) {
    const { count: all } = await supabase
      .from("archived_permits")
      .select("id", { count: "exact", head: true });
    archiveTotal = all ?? archiveTotal;
  }

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
  const sortParam = sort === "archived_desc" ? {} : { sort };

  const hrefWith = (params) => {
    const qs = new URLSearchParams(params).toString();
    return qs ? `/admin/archive?${qs}` : "/admin/archive";
  };
  const pageHref = (n) =>
    hrefWith({ ...filtersToParams(filters), ...sortParam, page: String(n) });

  const chips = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => ({
      key: k,
      label: CHIP_LABELS[k],
      value: v,
      href: hrefWith({ ...filtersToParams({ ...filters, [k]: "" }), ...sortParam }),
    }));

  const presets = archivePresets(today).map((p) => {
    // A preset replaces the archived-date range and keeps everything else.
    const params = { ...filtersToParams({ ...filters, from: "", to: "" }), ...sortParam, ...p.params };
    const active =
      Object.entries(p.params).every(([k, v]) => filters[k] === v) &&
      ["from", "to"].every((k) => (k in p.params ? true : !filters[k]));
    return { ...p, href: hrefWith(params), active };
  });

  // Passed to the client so "select all matching" / "export all" use
  // exactly the filters shown here.
  const filtersForClient = filtersToParams(filters);

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <p style={styles.crumb}>
          <Link prefetch={false} href="/admin" style={styles.crumbLink}>Admin</Link> / Archive
        </p>
        <h2 style={styles.heading}>Permit Archive</h2>
        <p style={styles.subheading}>
          Permits that were removed from the Excel file. {archiveTotal} archived in total.
          {canDelete && " Tick rows to permanently delete a permit and any attachments filed under it."}
        </p>

        <form method="get" className="archive-filters panel">
          <div className="archive-filters__row">
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Search permit no., job, holder or area"
              className="archive-filters__search"
              aria-label="Search archive"
            />
            <button type="submit" className="btn btn-primary">Apply filters</button>
            {(filtersActive || sort !== "archived_desc") && (
              <Link prefetch={false} href="/admin/archive" className="btn btn-ghost">Reset</Link>
            )}
          </div>

          <div className="archive-filters__row">
            <label className="archive-field">
              <span>Area</span>
              <select name="area" defaultValue={filters.area}>
                <option value="">All areas</option>
                {areaOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="archive-field">
              <span>Type</span>
              <select name="type" defaultValue={filters.type}>
                <option value="">All types</option>
                {typeOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="archive-field">
              <span>Last status</span>
              <select name="status" defaultValue={filters.status}>
                <option value="">All statuses</option>
                {statusOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="archive-field">
              <span>Sort by</span>
              <select name="sort" defaultValue={sort}>
                {Object.entries(ARCHIVE_SORTS).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="archive-filters__row">
            <fieldset className="archive-range">
              <legend>Archived between</legend>
              <input type="date" name="from" defaultValue={filters.from} aria-label="Archived from" />
              <span>to</span>
              <input type="date" name="to" defaultValue={filters.to} aria-label="Archived to" />
            </fieldset>
            <fieldset className="archive-range">
              <legend>Permit valid-to between</legend>
              <input type="date" name="vfrom" defaultValue={filters.vfrom} aria-label="Valid to from" />
              <span>to</span>
              <input type="date" name="vto" defaultValue={filters.vto} aria-label="Valid to until" />
            </fieldset>
          </div>

          <div className="archive-presets">
            <span className="archive-presets__label">Quick range (archived):</span>
            {presets.map((p) => (
              <Link prefetch={false}
                key={p.key}
                href={p.href}
                className={`archive-preset${p.active ? " is-active" : ""}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </form>

        {chips.length > 0 && (
          <div className="archive-chips" aria-label="Active filters">
            {chips.map((c) => (
              <Link prefetch={false} key={c.key} href={c.href} className="archive-chip" title="Remove this filter">
                <span className="archive-chip__name">{c.label}:</span> {c.value}
                <Icon name="x" size={12} />
              </Link>
            ))}
          </div>
        )}

        <p className="result-count">
          {filtersActive
            ? `${total} of ${archiveTotal} archived permits match`
            : `${total} archived permits`}
          {total > PAGE_SIZE && ` · page ${page} of ${lastPage}`}
        </p>

        {error && <p className="error-text">Could not load the archive.</p>}

        {!error && list.length === 0 && (
          <p style={styles.empty}>
            {filtersActive ? "No archived permits match your filters." : "Nothing archived yet."}
          </p>
        )}

        {list.length > 0 && (
          <ArchiveTable
            key={`${page}|${sort}|${JSON.stringify(filtersForClient)}`}
            rows={list}
            attachmentsByRef={attachmentsByRef}
            canDelete={canDelete}
            canExport={canExport}
            total={total}
            filters={filtersForClient}
            sort={sort}
            today={today}
          />
        )}

        {lastPage > 1 && (
          <div style={styles.pager}>
            {page > 1 && <Link prefetch={false} href={pageHref(page - 1)} className="btn btn-ghost">Previous</Link>}
            <span style={styles.pageInfo}>Page {page} of {lastPage}</span>
            {page < lastPage && <Link prefetch={false} href={pageHref(page + 1)} className="btn btn-ghost">Next</Link>}
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
  empty: { color: "var(--color-ink-muted)" },
  pager: { display: "flex", gap: 12, alignItems: "center", marginTop: 16 },
  pageInfo: { fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" },
};
