"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { isValidStaffId, isValidEmail, normalizeStaffId } from "../../lib/staffAuth";
import Icon from "../components/Icon";

export default function SignupForm() {
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | checking | error | sent
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!isValidStaffId(staffId)) {
      setState("error");
      setMessage("Enter a valid staff ID (letters/numbers, no spaces).");
      return;
    }
    if (!isValidEmail(email)) {
      setState("error");
      setMessage("Enter your real company email address.");
      return;
    }
    if (password.length < 8) {
      setState("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setState("error");
      setMessage("Passwords don't match.");
      return;
    }

    setState("checking");
    const normalizedId = normalizeStaffId(staffId);

    try {
      const checkRes = await fetch("/api/auth/check-staff-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: normalizedId }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok || !checkData.available) {
        setState("error");
        setMessage(checkData.error || "That staff ID is already registered.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { staff_id: normalizedId },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        setState("error");
        setMessage(
          error.message?.toLowerCase().includes("already registered")
            ? "That email is already registered — try signing in, or use Forgot password."
            : error.message
        );
        return;
      }

      setState("sent");
    } catch (err) {
      setState("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="panel passcode-card">
        <span className="passcode-icon">
          <Icon name="checkCircle" />
        </span>
        <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Check your email</h2>
        <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          We sent a confirmation link to <strong style={{ color: "var(--color-ink)" }}>{email}</strong>.
          Click it to activate your account — after that, sign in with staff ID{" "}
          <span className="mono">{normalizeStaffId(staffId)}</span>.
        </p>
        <Link href="/login" className="btn btn-ghost" style={{ marginTop: 14, justifyContent: "center" }}>
          <Icon name="arrowLeft" size={14} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Create account</h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        Verify with your company email. You'll sign in with your staff ID.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          placeholder="Staff ID"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="passcode-input"
          aria-label="Staff ID"
        />
        <input
          type="email"
          autoComplete="email"
          placeholder="Company email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="passcode-input"
          aria-label="Company email"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="passcode-input"
          aria-label="Password"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="passcode-input"
          aria-label="Confirm password"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!staffId || !email || !password || !confirmPassword || state === "checking"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {state === "checking" ? "Creating account…" : "Create account"}
        </button>
      </form>

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {message}
        </p>
      )}

      <p style={{ margin: "14px 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
