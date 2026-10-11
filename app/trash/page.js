import { redirect } from "next/navigation";
import TrashList from "./TrashList";
import { getSupabase } from "../../lib/db";
import { getViewer } from "../../lib/viewer";
import { omanDateTime } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const viewer = await getViewer();
  if (!viewer?.canViewTrash) redirect("/");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("permits")
    .select("id, reference, area, location, permit_type, status, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(1000);

  const ids = (data || []).map((p) => p.id);
  const counts = {};
  if (ids.length) {
    const { data: files } = await supabase.from("permit_files").select("permit_id").in("permit_id", ids).limit(5000);
    for (const f of files || []) counts[f.permit_id] = (counts[f.permit_id] || 0) + 1;
  }

  const rows = (data || []).map((p) => ({
    id: p.id,
    reference: p.reference,
    area: p.area,
    location: p.location,
    type: p.permit_type,
    status: p.status,
    deletedBy: p.deleted_by || "",
    deletedAt: omanDateTime(p.deleted_at),
    files: counts[p.id] || 0,
  }));

  return (
    <>
      <h2 className="page-title">Trash</h2>
      <p className="page-sub">
        Deleted permits wait here with their documents.{" "}
        {viewer.canPurgeTrash
          ? "Restore one, or delete it for good (Root only)."
          : "Root or HSE can restore them; only Root can delete them for good."}{" "}
        A trashed permit keeps its permit number reserved.
      </p>
      {error && (
        <div className="notice">
          The trash could not be read. Has <span className="mono">supabase/06-trash.sql</span> been run?
        </div>
      )}
      <TrashList rows={rows} canPurge={viewer.canPurgeTrash} />
    </>
  );
}
