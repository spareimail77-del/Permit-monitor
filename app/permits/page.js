import Link from "next/link";
import PageHeader from "../components/PageHeader";
import FilterBar from "../components/FilterBar";
import PermitsTable from "../components/PermitsTable";
import { getSupabase } from "../../lib/db";
import { getViewer } from "../../lib/viewer";
import { todayOman } from "../../lib/omanDate";
import { STATUS_FILTERS, computeStatus } from "../../lib/status";
import { filterPermits, filtersToQuery, hasFilters, monthLabel, monthOf, parseFilters } from "../../lib/permitFilters";
import { describeFiles, fetchFileSummary, withFiles } from "../../lib/permitFiles";

export const dynamic = "force-dynamic";

const PAGE = 1000;

function fmt(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

// Sortable columns: header text, and how to read the value to compare.
const STATUS_ORDER = { OVERDUE: 0, EXPIRING: 1, OPEN: 2, CLOSED: 3, CANCELED: 4, OTHER: 5 };
const COLUMNS = [
  { key: "reference", label: "Permit no.", get: (r) => r.reference },
  { key: "area", label: "Area", get: (r) => r.area },
  { key: "location", label: "Location", get: (r) => r.location },
  { key: "type", label: "Type", get: (r) => r.permit_type },
  { key: "applicant", label: "Applicant", get: (r) => r.applicant },
  { key: "holder", label: "Holder", get: (r) => r.holder },
  { key: "from", label: "From", get: (r) => r.valid_from },
  { key: "to", label: "To", get: (r) => r.valid_to },
  { key: "files", label: "Files", get: (r) => r.fileCount, numeric: true },
  { key: "status", label: "Status", get: (r) => STATUS_ORDER[r.st.key] ?? 9 },
];

function sortRows(rows, sort, dir) {
  const col = COLUMNS.find((c) => c.key === sort);
  if (!col) return rows;
  const sign = dir === "desc" ? -1 : 1;
  const blank = (v) => v === null || v === undefined || v === "";
  return [...rows].sort((a, b) => {
    const x = col.get(a);
    const y = col.get(b);
    if (blank(x) && blank(y)) return 0;
    if (blank(x)) return 1; // empty values always last
    if (blank(y)) return -1;
    const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "en", { sensitivity: "base", numeric: true });
    return c * sign;
  });
}

export default async function PermitsPage({ searchParams }) {
  const viewer = await getViewer();
  const supabase = getSupabase();
  const today = todayOman();
  const all = [];
  let failed = false;

  // The database returns at most 1000 rows per request, so read in pages.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("permits")
      .select("id, reference, area, location, permit_type, applicant, holder, valid_from, valid_to, status")
      .is("deleted_at", null)
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Reading permits failed:", error);
      failed = true;
      break;
    }
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  // Attachments: one query pass for the whole list. If it fails the list still works,
  // only without the file column data.
  const fileSummary = failed ? { map: new Map(), ok: false } : await fetchFileSummary(supabase);
  const permits = withFiles(all.map((r) => ({ ...r, st: computeStatus(r, today) })), fileSummary);

  // Filters from the address bar (the dashboard links here with ?status=, ?area=, ...).
  // lib/permitFilters.js is shared with the Excel export, so both give the same rows.
  const f = parseFilters((name) => one(searchParams?.[name]));
  let rows = filterPermits(permits, f);
  // Column sorting (?sort=to&dir=desc). Without it: overdue / expiring show what needs
  // action soonest, everything else stays newest-entered first.
  const sort = COLUMNS.some((c) => c.key === one(searchParams?.sort)) ? one(searchParams.sort) : "";
  const dir = sort && one(searchParams?.dir) === "desc" ? "desc" : "asc";
  if (sort) {
    rows = sortRows(rows, sort, dir);
  } else if (f.status === "overdue" || f.status === "expiring") {
    rows = [...rows].sort((a, b) => String(a.valid_to).localeCompare(String(b.valid_to)));
  }

  // Quick status tabs: counts follow every other filter, but not the status itself.
  const base = filterPermits(permits, { ...f, status: "" });
  const tabCount = (key) => base.filter((r) => r.st.key === key).length;
  const tabs = [
    { value: "", label: "All", n: base.length },
    { value: "open", label: "Open", n: tabCount("OPEN") },
    { value: "expiring", label: "Expiring", n: tabCount("EXPIRING") },
    { value: "overdue", label: "Overdue", n: tabCount("OVERDUE") },
    { value: "closed", label: "Closed", n: tabCount("CLOSED") },
    { value: "canceled", label: "Canceled", n: tabCount("CANCELED") },
  ];
  const sortQuery = sort ? `sort=${sort}${dir === "desc" ? "&dir=desc" : ""}` : "";
  const hrefFor = (filters, sortPart = sortQuery) => {
    const qs = [filtersToQuery(filters), sortPart].filter(Boolean).join("&");
    return qs ? `/permits?${qs}` : "/permits";
  };
  // Click a header: ascending, then descending, then back to the default order.
  const sortHref = (key) => hrefFor(f, sort !== key ? `sort=${key}` : dir === "asc" ? `sort=${key}&dir=desc` : "");

  // Months that have permits (by Valid from), newest first, with counts.
  const monthCounts = new Map();
  for (const r of permits) {
    const m = monthOf(r.valid_from);
    if (m) monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
  }
  const months = [...monthCounts.keys()].sort().reverse().map((m) => ({ value: m, label: monthLabel(m), count: monthCounts.get(m) }));

  const areas = [...new Set(permits.map((r) => r.area).filter(Boolean))].sort();
  const types = [...new Set(permits.map((r) => r.permit_type).filter(Boolean))].sort();
  const filtered = hasFilters(f);
  const exportHref = `/api/export${filtersToQuery(f) ? `?${filtersToQuery(f)}` : ""}`;

  // What the (client) table needs: plain data only.
  const tableRows = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    area: r.area,
    location: r.location,
    permit_type: r.permit_type,
    applicant: r.applicant,
    holder: r.holder,
    valid_from: r.valid_from,
    valid_to: r.valid_to,
    status: r.status,
    st: r.st,
    fileCount: r.fileCount,
    fileTip: r.files ? describeFiles(r.files) : "",
  }));
  const tableColumns = COLUMNS.map((c) => ({ key: c.key, label: c.label, href: sortHref(c.key), active: sort === c.key, dir }));

  return (
    <>
      <PageHeader
        title="Permits"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Permits" }]}
        sub={`${filtered ? `Showing ${rows.length} of ${permits.length}` : `${permits.length} permit${permits.length === 1 ? "" : "s"}`} · as of ${fmt(today)} (Oman time)`}
        actions={
          <>
            {viewer?.canExport && rows.length > 0 && (
              <a href={exportHref} className="btn" title="Downloads the rows shown below, in the Excel log layout">
                Export to Excel ({rows.length})
              </a>
            )}
          </>
        }
      />

      {searchParams?.trashed && (
        <div className="notice notice--ok">
          Permit <strong className="mono">{String(one(searchParams.trashed)).slice(0, 40)}</strong> was moved to the trash. Root or
          HSE can restore it from the Trash page.
        </div>
      )}

      {failed && (
        <div className="notice notice--danger">
          The permits could not be read. Has <span className="mono">supabase/01-permits.sql</span> been run, and are
          both environment variables set?
        </div>
      )}

      {!fileSummary.ok && !failed && (
        <div className="notice">The attachment information could not be read, so the Files column and filter are unavailable.</div>
      )}

      <FilterBar initial={f} statusOptions={STATUS_FILTERS} areas={areas} types={types} months={months} sort={sort} dir={dir} showFiles={fileSummary.ok} />

      <nav className="status-tabs" aria-label="Quick status filter">
        {tabs.map((t) => (
          <Link
            key={t.value || "all"}
            href={hrefFor({ ...f, status: t.value })}
            className={`status-tab${f.status === t.value ? " is-active" : ""}${t.value ? ` status-tab--${t.value}` : ""}`}
            aria-current={f.status === t.value ? "page" : undefined}
          >
            {t.label} <span className="status-tab__n">{t.n}</span>
          </Link>
        ))}
      </nav>

      <div className="panel table-wrap table-wrap--tall">
        {rows.length === 0 ? (
          <div className="empty empty--rich">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 13h6M10 17h4" />
            </svg>
            <p>{permits.length === 0 ? "No permits yet." : "No permit matches these filters."}</p>
            {filtered && (
              <Link href="/permits" className="btn btn-sm">
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <PermitsTable
            rows={tableRows}
            columns={tableColumns}
            canManage={Boolean(viewer?.canManagePermits)}
            canExport={Boolean(viewer?.canExport)}
          />
        )}
      </div>
    </>
  );
}
