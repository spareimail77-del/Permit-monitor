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

const LOG_VALUES = { in: "Still in the log", out: "No longer in the log" };

const CHIP_LABELS = {
  q: "Search",
  area: "Area",
  type: "Type",
  status: "Status",
  log: "Show",
  from: "Archived from",
  to: "Archived until",
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
      "id, reference, area, permit_type, job_description, holder, valid_to, excel_status, archived_at, in_log, updated_at",
      { count: "exact" }
    )
    .range(from, from + PAGE_SIZE - 1);
  query = applyArchiveFilters(query, filters);
  query = applyArchiveSort(query, sort);

  const { data: rows, count, error } = await query;
  const list = rows || [];

  // Sizes of the two groups, for the line under the heading.
  const [{ count: outCount }, { count: inCount }] = await Promise.all([
    supabase.from("archived_permits").select("id", { count: "exact", head: true }).eq("in_log", false),
    supabase.from("archived_permits").select("id", { count: "exact", head: true }).eq("in_log", true),
  ]);

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
  const countText =
    (filtersActive ? `${total} permits match` : `${total} permits`) +
    (total > PAGE_SIZE ? ` · page ${page} of ${lastPage}` : "");

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
      value: k === "log" ? LOG_VALUES[v] || v : v,
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
          A backup copy of every permit from the uploaded Excel. New and changed permits are copied here
          automatically and are never removed when they leave the log.{" "}
          {inCount ?? 0} still in the log · {outCount ?? 0} no longer in the log.
          {canDelete && " Tick rows to permanently delete a permit and any attachments filed under it."}
        </p>

        <form method="get" className="archive-filters">
          <div className="filter-bar">
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Search permit no., job, holder or area"
              aria-label="Search archive"
            />
            <select name="log" defaultValue={filters.log} aria-label="Show">
              <option value="">All permits</option>
              <option value="in">Still in the log</option>
              <option value="out">No longer in the log</option>
            </select>
            <select name="area" defaultValue={filters.area} aria-label="Area">
              <option value="">All areas</option>
              {areaOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select name="type" defaultValue={filters.type} aria-label="Permit type">
              <option value="">All permit types</option>
              {typeOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select name="status" defaultValue={filters.status} aria-label="Last status">
              <option value="">All statuses</option>
              {statusOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select name="sort" defaultValue={sort} aria-label="Sort by">
              {Object.entries(ARCHIVE_SORTS).map(([key, s]) => (
                <option key={key} value={key}>Sort: {s.label}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm">Apply filters</button>
            {(filtersActive || sort !== "archived_desc") && (
              <Link prefetch={false} href="/admin/archive" className="btn btn-ghost btn-sm">Reset</Link>
            )}
          </div>

          <div className="archive-dates">
            <fieldset className="archive-range">
              <legend>Archived between</legend>
              <input type="date" name="from" defaultValue={filters.from} aria-label="Archived from" />
              <span>to</span>
              <input type="date" name="to" defaultValue={filters.to} aria-label="Archived until" />
            </fieldset>
            <fieldset className="archive-range">
              <legend>Permit valid-to between</legend>
              <input type="date" name="vfrom" defaultValue={filters.vfrom} aria-label="Valid to from" />
              <span>to</span>
              <input type="date" name="vto" defaultValue={filters.vto} aria-label="Valid to until" />
            </fieldset>
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

        {error && <p className="error-text">Could not load the archive.</p>}

        {!error && list.length === 0 && (
          <p style={styles.empty}>
            {filtersActive ? "No archived permits match your filters." : "The archive is empty. Permits are copied here when you upload an Excel file."}
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
            countText={countText}
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
  body: { maxWidth: 1200, margin: "0 auto", padding: "28px 20px 48px" },
  crumb: { margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" },
  crumbLink: { color: "var(--color-brand-2)" },
  heading: { margin: "6px 0 0", fontSize: "var(--font-size-lg)", color: "var(--color-ink)" },
  subheading: { margin: "6px 0 18px", maxWidth: 760, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" },
  empty: { color: "var(--color-ink-muted)" },
  pager: { display: "flex", gap: 12, alignItems: "center", marginTop: 16 },
  pageInfo: { fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" },
};
