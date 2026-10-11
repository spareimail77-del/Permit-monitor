import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForms from "./ProfileForms";
import { getViewer } from "../../lib/viewer";
import { roleLabel } from "../../lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <>
      <h2 className="page-title">My profile</h2>
      <p className="page-sub">
        Staff ID <strong className="mono">{viewer.staffId}</strong> · {roleLabel(viewer.role)}
      </p>
      <ProfileForms initialName={viewer.name === viewer.staffId ? "" : viewer.name} />
      <p style={{ marginTop: 20 }}>
        <Link href="/">← Back to home</Link>
      </p>
    </>
  );
}
