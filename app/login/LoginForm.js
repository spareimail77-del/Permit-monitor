"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { staffIdToAuthEmail } from "../../lib/staffAuth";
import Icon from "../components/Icon";

const NOTICE_TEXT = {
  confirmed: "Account confirmed — sign in with your staff ID.",
  reset: "Password updated — sign in with your new password.",
};
const ERROR_TEXT = {
  confirm_failed: "That confirmation link is invalid or expired. Try signing up again.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | checking | error
  const [message, setMessage] = useState("");

  const notice =
    NOTICE_TEXT[searchParams.get("confirmed") ? "confirmed" : searchParams.get("reset") ? "reset" : ""];
  const urlError = ERROR_TEXT[searchParams.get("error")];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId || !password) return;
    setState("checking");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: staffIdToAuthEmail(staffId),
      password,
    });

    if (error) {
      setState("error");
      setMessage(
        error.message === "Invalid login credentials"
          ? "Wrong staff ID or password."
          : error.message
      );
      return;
    }

    const next = searchParams.get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>
        Permit Log Register
      </h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        Sign in with your staff ID to view the site.
      </p>

      {notice && (
        <p style={{ margin: "10px 0 0", color: "var(--color-open)", fontSize: "var(--font-size-sm)" }}>
          {notice}
        </p>
      )}
      {urlError && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {urlError}
        </p>
      )}

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
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="passcode-input"
          aria-label="Password"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!staffId || !password || state === "checking"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {state === "checking" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {message}
        </p>
      )}

      <p style={{ margin: "14px 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)", display: "flex", justifyContent: "space-between" }}>
        <Link href="/signup">Create account</Link>
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
    </div>
  );
}
