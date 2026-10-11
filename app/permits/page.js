import Link from "next/link";
import { getSupabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

const PAGE = 1000;

function fmt(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export default async function PermitsPage() {
  const supabase = getSupabase();
  const rows = [];
  let failed = false;

  // The database returns at most 1000 rows per request, so read in pages.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("permits")
      .select("id, reference, area, location, permit_type, applicant, holder, valid_from, valid_to, status")
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Reading permits failed:", error);
      failed = true;
      break;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 className="page-title">Permit list</h2>
          <p className="page-sub" style={{ margin: 0 }}>
            {rows.length} permit{rows.length === 1 ? "" : "s"}, newest first
          </p>
        </div>
        <Link href="/permits/new" className="btn btn-primary">
          + New permit
        </Link>
      </div>

      {failed && (
        <div className="notice">
          The permits could not be read. Has <span className="mono">supabase/01-permits.sql</span> been run, and are
          both environment variables set?
        </div>
      )}

      <div className="panel table-wrap">
        {rows.length === 0 ? (
          <p className="empty">No permits yet. Add the first one with the New permit button.</p>
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
                    <span className={`badge badge--${r.status}`}>{r.status}</span>
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
