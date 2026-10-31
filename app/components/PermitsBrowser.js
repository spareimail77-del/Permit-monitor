"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "./PageHeader";
import FilterBar from "./FilterBar";
import PermitsTable from "./PermitsTable";
import { STATUS_FILTERS, computeStatus } from "../../lib/status";
import { filterPermits, filtersToQuery, hasFilters, monthLabel, monthOf, parseFilters } from "../../lib/permitFilters";
import { describeFiles } from "../../lib/permitFiles";

// The permit list. The server sends ALL permits once; searching, filtering, sorting
// and the status tab counts then happen here in the browser, so a click does not
// wait for the database. The address bar still follows the filters (so links,
// bookmarks and the back button keep working), but changing it does not reload
// anything from the server. Security is unchanged: the server only ever sends this
// to a signed-in, active person, and every change (close, trash, edit) is still
// checked by the server and the database.

const fmt = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

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
  { key: "files", label: "Files", get: (r) => r.fileCount },
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

// Filters + sort -> "status=overdue&sort=to&dir=desc"
function toQuery(f, sort, dir) {
  return [filtersToQuery(f), sort ? `sort=${sort}${dir === "desc" ? "&dir=desc" : ""}` : ""].filter(Boolean).join("&");
}

function readSort(get) {
  const s = String(get("sort") ?? "");
  const sort = COLUMNS.some((c) => c.key === s) ? s : "";
  return { sort, dir: sort && get("dir") === "desc" ? "desc" : "asc" };
}

export default function PermitsBrowser({ permits, today, filesOk, canManage, canExport }) {
  const searchParams = useSearchParams();
  const initial = useMemo(() => {
    const get = (n) => searchParams.get(n) ?? "";
    return { f: parseFilters(get), ...readSort(get) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [f, setF] = useState(initial.f);
  const [sort, setSort] = useState(initial.sort);
  const [dir, setDir] = useState(initial.dir);
  const lastQuery = useRef(toQuery(initial.f, initial.sort, initial.dir));

  // The address changed from outside (a dashboard link, the back button): follow it.
  const spKey = searchParams.toString();
  useEffect(() => {
    const get = (n) => searchParams.get(n) ?? "";
    const nextF = parseFilters(get);
    const s = readSort(get);
    const q = toQuery(nextF, s.sort, s.dir);
    if (q === lastQuery.current) return;
    lastQuery.current = q;
    setF(nextF);
    setSort(s.sort);
    setDir(s.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey]);

  // Apply new filters / sort: update the screen now, and the address bar quietly.
  const apply = useCallback((nextF, nextSort, nextDir, { replace = false } = {}) => {
    setF(nextF);
    setSort(nextSort);
    setDir(nextDir);
    const q = toQuery(nextF, nextSort, nextDir);
    if (q === lastQuery.current) return;
    lastQuery.current = q;
    const url = q ? `/permits?${q}` : "/permits";
    try {
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    } catch {
      // Address bar not updatable: the screen is still right.
    }
  }, []);

  const onFilter = (name, value, opts) => apply({ ...f, [name]: value }, sort, dir, opts);
  const onClear = () => apply(parseFilters(() => ""), sort, dir);
  // Click a header: ascending, then descending, then back to the default order.
  const onSort = (key) => {
    if (sort !== key) apply(f, key, "asc");
    else if (dir === "asc") apply(f, key, "desc");
    else apply(f, "", "asc");
  };

  // Status of every permit, worked out once per data load.
  const all = useMemo(
    () =>
      permits.map((r) => {
        const fileCount = r.files ? r.files.permit_copy + r.files.jsa + r.files.certificate + r.files.other : undefined;
        return { ...r, fileCount, st: computeStatus(r, today) };
      }),
    [permits, today]
  );

  const view = useMemo(() => {
    let rows = filterPermits(all, f);
    if (sort) rows = sortRows(rows, sort, dir);
    else if (f.status === "overdue" || f.status === "expiring") {
      rows = [...rows].sort((a, b) => String(a.valid_to).localeCompare(String(b.valid_to)));
    }

    const base = filterPermits(all, { ...f, status: "" });
    const counts = {};
    for (const r of base) counts[r.st.key] = (counts[r.st.key] || 0) + 1;

    const monthCounts = new Map();
    for (const r of all) {
      const m = monthOf(r.valid_from);
      if (m) monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
    }
    const months = [...monthCounts.keys()].sort().reverse().map((m) => ({ value: m, label: monthLabel(m), count: monthCounts.get(m) }));
    const areas = [...new Set(all.map((r) => r.area).filter(Boolean))].sort();
    const types = [...new Set(all.map((r) => r.permit_type).filter(Boolean))].sort();

    return { rows, base: base.length, counts, months, areas, types };
  }, [all, f, sort, dir]);

  const tableRows = useMemo(() => view.rows.map((r) => ({ ...r, fileTip: r.files ? describeFiles(r.files) : "" })), [view.rows]);
  const tableColumns = COLUMNS.map((c) => ({ key: c.key, label: c.label, active: sort === c.key, dir }));

  const filtered = hasFilters(f);
  const tabs = [
    { value: "", label: "All", n: view.base },
    { value: "open", label: "Open", n: view.counts.OPEN || 0 },
    { value: "expiring", label: "Expiring", n: view.counts.EXPIRING || 0 },
    { value: "overdue", label: "Overdue", n: view.counts.OVERDUE || 0 },
    { value: "closed", label: "Closed", n: view.counts.CLOSED || 0 },
    { value: "canceled", label: "Canceled", n: view.counts.CANCELED || 0 },
  ];
  const exportHref = `/api/export${filtersToQuery(f) ? `?${filtersToQuery(f)}` : ""}`;
  const total = all.length;

  return (
    <>
      <PageHeader
        title="Permits"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Permits" }]}
        sub={`${filtered ? `Showing ${view.rows.length} of ${total}` : `${total} permit${total === 1 ? "" : "s"}`} · as of ${fmt(today)} (Oman time)`}
        actions={
          canExport && view.rows.length > 0 ? (
            <a href={exportHref} className="btn" title="Downloads the rows shown below, in the Excel log layout">
              Export to Excel ({view.rows.length})
            </a>
          ) : null
        }
      />

      {!filesOk && <div className="notice">The attachment information could not be read, so the Files column and filter are unavailable.</div>}

      <FilterBar value={f} onChange={onFilter} onClear={onClear} statusOptions={STATUS_FILTERS} areas={view.areas} types={view.types} months={view.months} showFiles={filesOk} />

      <nav className="status-tabs" aria-label="Quick status filter">
        {tabs.map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            onClick={() => onFilter("status", t.value)}
            className={`status-tab${f.status === t.value ? " is-active" : ""}${t.value ? ` status-tab--${t.value}` : ""}`}
            aria-pressed={f.status === t.value}
          >
            {t.label} <span className="status-tab__n">{t.n}</span>
          </button>
        ))}
      </nav>

      <div className="panel table-wrap table-wrap--tall">
        {tableRows.length === 0 ? (
          <div className="empty empty--rich">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 13h6M10 17h4" />
            </svg>
            <p>{total === 0 ? "No permits yet." : "No permit matches these filters."}</p>
            {filtered && (
              <button type="button" className="btn btn-sm" onClick={onClear}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <PermitsTable rows={tableRows} columns={tableColumns} onSort={onSort} canManage={canManage} canExport={canExport} />
        )}
      </div>
    </>
  );
}
