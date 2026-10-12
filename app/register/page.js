import Link from "next/link";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <p className="auth-brand">
          SWWS — Salalah
        </p>
        <h1 className="page-title">Request an account</h1>
        <p className="page-sub">Root must approve your request before you can sign in.</p>
        <RegisterForm />
        <p className="pform-hint mt-4">
          <Link href="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
