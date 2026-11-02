import PermitsBrowser from "../components/PermitsBrowser";
import { getSupabase } from "../../lib/db";
import { getViewer } from "../../lib/viewer";
import { todayOman } from "../../lib/omanDate";
import { fetchFileSummary } from "../../lib/permitFiles";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

// The server only reads the data (once) and hands it over. Searching, filtering,
// sorting and the tab counts are done in the browser by PermitsBrowser, so they
// do not read the database again.
export default async function PermitsPage({ searchParams }) {
  const viewer = await getViewer();
  const supabase = getSupabase();
  const today = todayOman();

  // The database returns at most 1000 rows per request, so read in pages.
  // Permits and attachments are independent, so they are read at the same time.
  const readPermits = async () => {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("permits")
        .select("id, reference, area, location, permit_type, applicant, holder, valid_from, valid_to, status")
        .is("deleted_at", null)
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("Reading permits failed:", error);
        return null;
      }
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  };

  // A guest cannot see attachments at all, so nothing is asked about them.
  const hideFiles = viewer?.canViewFiles === false;
  const [rows, fileSummary] = await Promise.all([readPermits(), hideFiles ? { ok: false, map: new Map() } : fetchFileSummary(supabase)]);
  const failed = rows === null;

  const permits = (rows || []).map((r) => ({
    ...r,
    // Only when the files could be read (a Map cannot be sent to the browser, so plain counts).
    ...(fileSummary.ok ? { files: fileSummary.map.get(r.id) || { permit_copy: 0, jsa: 0, certificate: 0, other: 0 } } : {}),
  }));

  return (
    <>
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

      <PermitsBrowser
        permits={permits}
        today={today}
        filesOk={fileSummary.ok || failed}
        canManage={Boolean(viewer?.canManagePermits)}
        canExport={Boolean(viewer?.canExport)}
        hideFiles={hideFiles}
      />
    </>
  );
}
