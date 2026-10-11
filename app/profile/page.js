import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForms from "./ProfileForms";
import StaffIdCard from "./StaffIdCard";
import { getSupabase } from "../../lib/db";
import { getViewer } from "../../lib/viewer";
import { roleLabel } from "../../lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // The person's latest Staff ID change request (they may read their own rows).
  const { data: reqs } = await getSupabase()
    .from("staff_id_change_requests")
    .select("old_staff_id, new_staff_id, status, decision_note")
    .eq("user_id", viewer.id)
    .order("id", { ascending: false })
    .limit(1);
  const r = reqs?.[0];
  const latest = r ? { oldId: r.old_staff_id, newId: r.new_staff_id, status: r.status, note: r.decision_note || "" } : null;

  return (
    <>
      <h2 className="page-title">My profile</h2>
      <p className="page-sub">
        Staff ID <strong className="mono">{viewer.staffId}</strong> · {roleLabel(viewer.role)}
      </p>
      <ProfileForms initialName={viewer.name === viewer.staffId ? "" : viewer.name} />
      <div style={{ marginTop: 16 }}>
        <StaffIdCard currentId={viewer.staffId} latest={latest} />
      </div>
      <p style={{ marginTop: 20 }}>
        <Link href="/">← Back to home</Link>
      </p>
    </>
  );
}
