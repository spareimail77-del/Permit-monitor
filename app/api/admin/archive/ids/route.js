import { createClient } from "../../../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../../../lib/authz";
import { applyArchiveFilters, parseArchiveFilters } from "../../../../../lib/archiveFilters";

// Returns the ids of every archived permit matching the given filters,
// so the archive page can offer "select all N matching". Read-only; the
// actual deleting still goes through /api/admin/archive/delete in
// small batches.

const PAGE = 1000; // PostgREST returns at most 1000 rows per request
const HARD_CAP = 5000;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "manage_archive")) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const filters = parseArchiveFilters(body.filters || {});

  const ids = [];
  let total = 0;
  for (let from = 0; from < HARD_CAP; from += PAGE) {
    let query = supabase
      .from("archived_permits")
      .select("id", { count: "exact" })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    query = applyArchiveFilters(query, filters);
    const { data, count, error } = await query;
    if (error) {
      return Response.json({ error: "Could not look up the matching permits." }, { status: 500 });
    }
    total = count ?? total;
    ids.push(...(data || []).map((r) => r.id));
    if (!data || data.length < PAGE) break;
  }

  return Response.json({ ids, total, truncated: total > ids.length });
}
