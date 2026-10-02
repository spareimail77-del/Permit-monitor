import { getAccess } from "./authz";
import { getCurrentUser } from "./supabase/user";

// Who is looking at the page, as far as "my permits" is concerned:
//   access  - role/status (same shape as getAccess)
//   names   - Set of normalised Excel names linked to this account
//   labels  - the same names, for display
//   linksAvailable - false if the links table is missing (migration not run)
// Never throws: a problem just means "no linked names".
export async function loadViewer(supabase) {
  const empty = {
    userId: null,
    access: { role: null, status: null, active: false },
    names: new Set(),
    labels: [],
    linksAvailable: true,
  };
  try {
    const user = await getCurrentUser(supabase);
    if (!user) return empty;

    const [access, links] = await Promise.all([
      getAccess(supabase, user.id),
      supabase.from("excel_name_links").select("excel_name").eq("user_id", user.id),
    ]);

    const labels = (links.data || []).map((r) => r.excel_name).sort();
    return {
      userId: user.id,
      access,
      names: new Set(labels),
      labels,
      linksAvailable: !links.error,
    };
  } catch (err) {
    console.error("Could not load viewer links:", err);
    return empty;
  }
}
