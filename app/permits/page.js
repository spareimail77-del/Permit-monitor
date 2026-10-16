import Link from "next/link";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import FilterBar from "../components/FilterBar";
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

      <FilterBar initial={f} statusOptions={STATUS_FILTERS} areas={areas} types={types} />

      <div className="panel table-wrap">
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
          <table className="table table--rows table--cards">
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
                <tr key={r.id} className={`row-link row-link--${r.st.key}`}>
                  <td className="mono" data-label="Permit no.">
                    <Link href={`/permits/${r.id}`} className="row-link__a" aria-label={`Open permit ${r.reference}`}>
                      {r.reference}
                    </Link>
                  </td>
                  <td data-label="Area">{r.area || "—"}</td>
                  <td data-label="Location">{r.location || "—"}</td>
                  <td data-label="Type">{r.permit_type || "—"}</td>
                  <td data-label="Applicant">{r.applicant || "—"}</td>
                  <td data-label="Holder">{r.holder || "—"}</td>
                  <td className="mono" data-label="From">{fmt(r.valid_from)}</td>
                  <td className="mono" data-label="To">{fmt(r.valid_to)}</td>
                  <td data-label="Status">
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
