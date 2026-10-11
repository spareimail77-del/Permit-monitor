import Link from "next/link";
import ForgotForm from "./ForgotForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <p className="site-title__small" style={{ color: "var(--brand)" }}>
          SWWS — Salalah
        </p>
        <h2 className="page-title">Forgot password</h2>
        <p className="page-sub">No email is sent. Root sees your request and gives you a temporary password.</p>
        <ForgotForm />
        <p className="pform-hint" style={{ marginTop: 16 }}>
          <Link href="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
