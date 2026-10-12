import Link from "next/link";
import ForgotForm from "./ForgotForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <p className="auth-brand">
          SWWS — Salalah
        </p>
        <h1 className="page-title">Forgot password</h1>
        <p className="page-sub">No email is sent. Root sees your request and gives you a temporary password.</p>
        <ForgotForm />
        <p className="pform-hint mt-4">
          <Link href="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
