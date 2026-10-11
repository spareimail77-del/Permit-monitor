import Link from "next/link";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

const REASONS = {
  pending: "Your account is waiting for approval. Please contact Root.",
  disabled: "This account has been disabled. Please contact Root.",
};

export default function LoginPage({ searchParams }) {
  const reason = REASONS[searchParams?.reason] || "";
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <p className="site-title__small" style={{ color: "var(--brand)" }}>
          SWWS — Salalah
        </p>
        <h2 className="page-title">HSE Permits</h2>
        <p className="page-sub">Sign in with your Staff ID.</p>
        {reason && <div className="notice">{reason}</div>}
        <LoginForm next={searchParams?.next || "/"} />
        <p className="pform-hint" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/register">Request an account</Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
