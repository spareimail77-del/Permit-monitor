import Link from "next/link";
import StatusBadge from "../components/StatusBadge";
import { getSupabase } from "../../lib/db";
import { getViewer } from "../../lib/viewer";
import { todayOman } from "../../lib/omanDate";
import { STATUS_FILTERS, computeStatus } from "../../lib/status";
import { filterPermits, filtersToQuery, hasFilters, parseFilters } from "../../lib/permitFilters";

export const dynamic = "force-dynamic";

const PAGE = 1000;

function fmt(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

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

  const permits = all.map((r) => ({ ...r, st: computeStatus(r, today) }));

  // Filters from the address bar (the dashboard links here with ?status=, ?area=, ...).
  // lib/permitFilters.js is shared with the Excel export, so both give the same rows.
  const f = parseFilters((name) => one(searchParams?.[name]));
  let rows = filterPermits(permits, f);
  // Overdue / expiring first show what needs action soonest.
  if (f.status === "overdue" || f.status === "expiring") {
    rows = [...rows].sort((a, b) => String(a.valid_to).localeCompare(String(b.valid_to)));
  }

  const areas = [...new Set(permits.map((r) => r.area).filter(Boolean))].sort();
  const types = [...new Set(permits.map((r) => r.permit_type).filter(Boolean))].sort();
  const filtered = hasFilters(f);
  const exportHref = `/api/export${filtersToQuery(f) ? `?${filtersToQuery(f)}` : ""}`;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 className="page-title">Permit list</h2>
          <p className="page-sub" style={{ margin: 0 }}>
            {filtered ? `Showing ${rows.length} of ${permits.length}` : `${permits.length} permit${permits.length === 1 ? "" : "s"}`}
            {" · "}as of {fmt(today)} (Oman time)
          </p>
        </div>
        <div className="row-actions">
          {viewer?.canExport && rows.length > 0 && (
            <a href={exportHref} className="btn" title="Downloads the rows shown below, in the Excel log layout">
              Export to Excel ({rows.length})
            </a>
          )}
          {viewer?.canManagePermits && (
            <Link href="/permits/new" className="btn btn-primary">
              + New permit
            </Link>
          )}
        </div>
      </div>

      {searchParams?.trashed && (
        <div className="notice notice--ok">
          Permit <strong className="mono">{String(one(searchParams.trashed)).slice(0, 40)}</strong> was moved to the trash. Root or
          HSE can restore it from the Trash page.
        </div>
      )}

      {failed && (
        <div className="notice">
          The permits could not be read. Has <span className="mono">supabase/01-permits.sql</span> been run, and are
          both environment variables set?
        </div>
      )}

      <form method="get" action="/permits" className="panel filter-bar">
        <input name="q" className="pform-input" defaultValue={f.q} placeholder="Search number, location, applicant, holder" aria-label="Search" />
        <select name="status" className="pform-input" defaultValue={f.status} aria-label="Status">
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="area" className="pform-input" defaultValue={f.area} aria-label="Area">
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select name="type" className="pform-input" defaultValue={f.type} aria-label="Type of permit">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {f.applicant && <input type="hidden" name="applicant" value={f.applicant} />}
        {f.holder && <input type="hidden" name="holder" value={f.holder} />}
        <button type="submit" className="btn btn-primary btn-sm">
          Apply
        </button>
        {filtered && (
          <Link href="/permits" className="btn btn-sm">
            Clear
          </Link>
        )}
      </form>
      {(f.applicant || f.holder) && (
        <p className="pform-hint" style={{ margin: "-6px 0 12px" }}>
          {f.applicant && <>Applicant = <strong>{f.applicant}</strong> </>}
          {f.holder && <>Holder = <strong>{f.holder}</strong> </>}
          (use Clear to remove)
        </p>
      )}

      <div className="panel table-wrap">
        {rows.length === 0 ? (
          <p className="empty">{permits.length === 0 ? "No permits yet. There is nothing to show yet." : "No permit matches these filters."}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Permit no.</th>
                <th>Area</th>
                <th>Location</th>
                <th>Type</th>
                <th>Applicant</th>
                <th>Holder</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link href={`/permits/${r.id}`}>{r.reference}</Link>
                  </td>
                  <td>{r.area || "—"}</td>
                  <td>{r.location || "—"}</td>
                  <td>{r.permit_type || "—"}</td>
                  <td>{r.applicant || "—"}</td>
                  <td>{r.holder || "—"}</td>
                  <td className="mono">{fmt(r.valid_from)}</td>
                  <td className="mono">{fmt(r.valid_to)}</td>
                  <td>
                    <StatusBadge status={r.st} showDetail />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
