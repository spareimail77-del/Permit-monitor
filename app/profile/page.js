import { redirect } from "next/navigation";
import PageHeader from "../components/PageHeader";
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
      <PageHeader
        title="My profile"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "My profile" }]}
        sub={
          <>
            Staff ID <strong className="mono">{viewer.staffId}</strong> · {roleLabel(viewer.role)}
          </>
        }
      />
      <div className="stack">
        <ProfileForms initialName={viewer.name === viewer.staffId ? "" : viewer.name} />
        <div id="staff-id">
          <StaffIdCard currentId={viewer.staffId} latest={latest} />
        </div>
      </div>
    </>
  );
}
