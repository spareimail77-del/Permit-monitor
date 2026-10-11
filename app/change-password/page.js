import { redirect } from "next/navigation";
import ChangePasswordForm from "./ChangePasswordForm";
import { getViewer } from "../../lib/viewer";

export const dynamic = "force-dynamic";

// Where a person lands after signing in with a temporary password.
export default async function ChangePasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <h2 className="page-title">Choose a new password</h2>
        <p className="page-sub">
          Signed in as <strong className="mono">{viewer.staffId}</strong>. Enter the temporary password Root gave you, then a
          password of your own.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
