import { requireActive } from "../../../../lib/adminAuth";
import { getAdminCounts } from "../../../../lib/adminCounts";

export const dynamic = "force-dynamic";

// What is waiting for Root: { pendingUsers, passwordRequests, idChanges }.
// Root only (middleware checks the URL, and requireActive checks again).
// The menu in the header asks for this once a day, or when Root presses Refresh.
export async function GET() {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const counts = await getAdminCounts(a.admin);
  return Response.json(counts, { headers: { "Cache-Control": "no-store" } });
}
