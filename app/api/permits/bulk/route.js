import { getSupabase } from "../../../../lib/db";
import { getViewer } from "../../../../lib/viewer";
import { can } from "../../../../lib/permissions";
import { todayOman } from "../../../../lib/omanDate";
import { statusPatch } from "../../../../lib/permitRules";

// Several permits at once, from the permit list. Root and HSE only (middleware: /api/permits
// needs manage_permits; checked again here, and the database policies check a third time).
// Body: { ids: [1, 2, 3], action: "trash" | "close" | "restore" | "reopen" }
//   trash   moves permits to the trash (soft delete, nothing is erased)
//   close   closes OPEN permits (same rule as the single-permit "close")
//   restore takes permits back out of the trash      (the Undo of "trash")
//   reopen  reopens closed/canceled permits          (the Undo of "close")
// There is NO permanent delete here: that stays on the Trash page, for Root only.
// Answer: { ok, action, changed: [ids that were really changed], skipped: number }

const MAX_IDS = 200;
const ACTIONS = ["trash", "close", "restore", "reopen"];
const bad = (error, status = 400) => Response.json({ error }, { status });

export async function POST(request) {
  const viewer = await getViewer();
  if (!viewer) return bad("Not authenticated.", 401);
  if (!can(viewer.role, "manage_permits")) return bad("Not authorized.", 403);

  const body = await request.json().catch(() => null);
  if (!body || !ACTIONS.includes(body.action)) return bad("Unknown action.");
  if (!Array.isArray(body.ids)) return bad("No permits were chosen.");
  const ids = [...new Set(body.ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return bad("No permits were chosen.");
  if (ids.length > MAX_IDS) return bad(`Choose at most ${MAX_IDS} permits at a time.`);

  const supabase = getSupabase();
  const { data: found, error: readError } = await supabase
    .from("permits")
    .select("id, status, closed_at, deleted_at")
    .in("id", ids);
  if (readError) {
    console.error("Bulk: reading permits failed:", readError);
    return bad("The permits could not be read. Please try again.", 500);
  }

  const today = todayOman();
  const now = new Date().toISOString();
  const live = (found || []).filter((p) => !p.deleted_at);
  let eligible;
  let patch;
  let guard = (q) => q;

  switch (body.action) {
    case "trash":
      eligible = live;
      patch = { deleted_at: now, deleted_by: viewer.staffId };
      guard = (q) => q.is("deleted_at", null);
      break;
    case "close":
      eligible = live.filter((p) => p.status === "OPEN");
      patch = statusPatch({ status: "OPEN", closed_at: null }, "CLOSED", "", today);
      guard = (q) => q.is("deleted_at", null).eq("status", "OPEN");
      break;
    case "reopen":
      eligible = live.filter((p) => p.status !== "OPEN");
      patch = statusPatch({ status: "CLOSED", closed_at: null }, "OPEN", "", today);
      guard = (q) => q.is("deleted_at", null).neq("status", "OPEN");
      break;
    default: // restore
      eligible = (found || []).filter((p) => p.deleted_at);
      patch = { deleted_at: null, deleted_by: null };
      guard = (q) => q.not("deleted_at", "is", null);
  }

  if (eligible.length === 0) {
    return Response.json({ ok: true, action: body.action, changed: [], skipped: ids.length });
  }

  const { data, error } = await guard(
    supabase
      .from("permits")
      .update({ ...patch, updated_at: now })
      .in("id", eligible.map((p) => p.id))
  ).select("id");
  if (error) {
    console.error("Bulk action failed:", error);
    return bad("The action could not be completed. Please try again.", 500);
  }

  const changed = (data || []).map((r) => r.id);
  if (changed.length === 0) return bad("You are not allowed to change these permits.", 403);
  return Response.json({ ok: true, action: body.action, changed, skipped: ids.length - changed.length });
}
