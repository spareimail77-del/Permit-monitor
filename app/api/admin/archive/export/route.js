import { createClient } from "../../../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../../../lib/authz";
import {
  applyArchiveFilters,
  applyArchiveSort,
  parseArchiveFilters,
  parseSort,
} from "../../../../../lib/archiveFilters";
import { fetchPermitData } from "../../../../../lib/parsePermits";

// Returns the archived rows (plus the master log's header block) as
// JSON. The Excel file itself is built in the browser, so this route
// only reads data and never creates files or storage.

const PAGE = 1000;
const HARD_CAP = 5000;
const MAX_IDS = 200;
const COLUMNS =
  "id, reference, area, location, permit_type, job_description, holder, applicant, valid_from, valid_to, excel_status, data, archived_at";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "export_data")) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id) => typeof id === "string" && id))]
    : null;

  let rows = [];
  let truncated = false;

  if (ids) {
    if (ids.length === 0) return Response.json({ error: "No permits selected." }, { status: 400 });
    if (ids.length > MAX_IDS) {
      return Response.json({ error: `Select ${MAX_IDS} or fewer, or export by filter.` }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("archived_permits")
      .select(COLUMNS)
      .in("id", ids)
      .order("reference", { ascending: true });
    if (error) return Response.json({ error: "Could not read the selected permits." }, { status: 500 });
    rows = data || [];
  } else {
    const filters = parseArchiveFilters(body.filters || {});
    const sort = parseSort(body.sort);
    for (let from = 0; from < HARD_CAP; from += PAGE) {
      let query = supabase
        .from("archived_permits")
        .select(COLUMNS)
        .range(from, from + PAGE - 1);
      query = applyArchiveFilters(query, filters);
      query = applyArchiveSort(query, sort);
      const { data, error } = await query;
      if (error) return Response.json({ error: "Could not read the archive." }, { status: 500 });
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
      if (from + PAGE >= HARD_CAP) truncated = true;
    }
  }

  // Header block of the current master log, so the export looks like it.
  // If there is no master file (or it can't be read) the client falls
  // back to a plain header row.
  let template = null;
  try {
    const master = await fetchPermitData();
    if (!master.error) template = master.template || null;
  } catch (err) {
    console.error("Export: could not read master template:", err);
  }

  return Response.json({ rows, template, truncated });
}
