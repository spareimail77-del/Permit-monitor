import { readFile } from "fs/promises";
import path from "path";
import { getSupabase } from "../../../lib/db";
import { getViewer } from "../../../lib/viewer";
import { can } from "../../../lib/permissions";
import { todayOman } from "../../../lib/omanDate";
import { computeStatus } from "../../../lib/status";
import { filterPermits, parseFilters } from "../../../lib/permitFilters";
import { fetchFileSummary, withFiles } from "../../../lib/permitFiles";
import { permitToExportRow } from "../../../lib/exportRows";
import { buildFilledWorkbook } from "../../../lib/exportMaster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE = 1000;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Excel export, Root and HSE only (middleware: /api/export needs export_data;
// checked again here). Takes the SAME filters as the permit list, in the address
// (?status=overdue&area=CCS ...), so the file holds exactly the rows the list shows.
// Order: the order the permits were entered, oldest first, like the Excel log.
// Permits in the trash are never exported.
export async function GET(request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (!can(viewer.role, "export_data")) return Response.json({ error: "Not authorized." }, { status: 403 });

  const url = new URL(request.url);
  // ?ids=1,2,3 = "Export selected" from the permit list: exactly those permits, no other filter.
  const idsParam = url.searchParams.get("ids");
  const ids = idsParam
    ? new Set(idsParam.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200))
    : null;
  const filters = ids ? parseFilters(() => "") : parseFilters((name) => url.searchParams.get(name));
  const today = todayOman();

  const supabase = getSupabase();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("permits")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Export: reading permits failed:", error);
      return Response.json({ error: "The permits could not be read." }, { status: 500 });
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  // Attachment data is only read when the "files" filter is used.
  let withSt = rows.map((r) => ({ ...r, st: computeStatus(r, today) }));
  if (filters.files) withSt = withFiles(withSt, await fetchFileSummary(supabase));

  const permits = filterPermits(withSt, filters)
    .filter((r) => !ids || ids.has(r.id))
    .map((r) => permitToExportRow(r, today));

  let masterBuffer;
  try {
    masterBuffer = await readFile(path.join(process.cwd(), "assets", "permit-template.xlsx"));
  } catch (e) {
    console.error("Export: the template file could not be read:", e);
    return Response.json({ error: "The Excel template is missing on the server (assets/permit-template.xlsx)." }, { status: 500 });
  }

  let file;
  try {
    file = await buildFilledWorkbook({ masterBuffer, permits });
  } catch (e) {
    console.error("Export: building the workbook failed:", e);
    return Response.json({ error: "The Excel file could not be built." }, { status: 500 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="Permit-Log-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
