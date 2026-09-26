"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "../components/Icon";
import { isValidEmail } from "../../lib/staffAuth";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState("email"); // email | otp
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | busy | error
  const [message, setMessage] = useState("");

  async function handleRequestCode(e) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setState("error");
      setMessage("Enter a valid email.");
      return;
    }
    setState("busy");
    setMessage("");
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setState("idle");
      setStep("otp");
    } catch (err) {
      setState("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!code || code.trim().length < 6) {
      setState("error");
      setMessage("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setState("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setState("error");
      setMessage("Passwords don't match.");
      return;
    }
    setState("busy");
    setMessage("");
    try {
      const res = await fetch("/api/auth/complete-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Something went wrong.");
        return;
      }
      router.push("/login?reset=1");
    } catch (err) {
      setState("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Reset password</h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        {step === "email"
          ? "We'll email a code to your company address."
          : `Enter the code sent to ${email}.`}
      </p>

      {step === "email" ? (
        <form onSubmit={handleRequestCode} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <input
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="Company email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="passcode-input"
            aria-label="Company email"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!email || state === "busy"}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {state === "busy" ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="passcode-input"
            aria-label="Verification code"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="passcode-input"
            aria-label="New password"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="passcode-input"
            aria-label="Confirm new password"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!code || !newPassword || !confirmPassword || state === "busy"}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {state === "busy" ? "Resetting…" : "Reset password"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setState("idle");
              setMessage("");
            }}
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Use a different email
          </button>
        </form>
      )}

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {message}
        </p>
      )}

      <p style={{ margin: "14px 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
        <Link href="/login">
          <Icon name="arrowLeft" size={12} /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
