import { guardAdminPage } from "../../../lib/adminPage";
import { getAdminCounts } from "../../../lib/adminCounts";
import { omanDateTime } from "../../../lib/format";
import AdminNav from "../../components/AdminNav";
import KeyMissing from "../KeyMissing";
import IdChangesList from "./IdChangesList";

export const dynamic = "force-dynamic";

export default async function IdChangesPage() {
  const { admin } = await guardAdminPage();
  if (!admin) return <KeyMissing />;

  const [{ data, error }, counts] = await Promise.all([
    admin
      .from("staff_id_change_requests")
      .select("id, old_staff_id, new_staff_id, reason, status, decision_note, created_at, decided_by, decided_at")
      .order("id", { ascending: false })
      .limit(100),
    getAdminCounts(admin),
  ]);

  const rows = (data || []).map((r) => ({
    id: r.id,
    oldId: r.old_staff_id,
    newId: r.new_staff_id,
    reason: r.reason || "",
    status: r.status,
    note: r.decision_note || "",
    created: omanDateTime(r.created_at),
    decidedBy: r.decided_by || "",
    decided: r.decided_at ? omanDateTime(r.decided_at) : "",
  }));

  return (
    <>
      <h2 className="page-title">Staff ID changes</h2>
      <p className="page-sub">When approved, the person signs in with the new Staff ID and the same password.</p>
      <AdminNav active="ids" counts={counts} />
      {error && (
        <div className="notice">
          Could not read the requests. Has <span className="mono">supabase/04-users-admin.sql</span> been run?
        </div>
      )}
      <IdChangesList rows={rows} />
    </>
  );
}
