"use client";

import { useState } from "react";
import { PASSWORD_MIN } from "../../lib/authRules";

export default function ChangePasswordForm({ forced }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | error | done
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (next !== confirm) {
      setState("error");
      setMessage("The two new passwords do not match.");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not change the password.");
        return;
      }
      setState("done");
      // Full page load (not router.replace): the app router may have
      // cached the earlier "go to /change-password" redirect for "/",
      // which would bounce the person straight back here.
      window.location.assign("/");
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div className="panel" style={{ padding: 24 }}>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Change password</h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        {forced
          ? "You signed in with a temporary password. Choose a new one to continue."
          : "Enter your current password, then choose a new one."}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          type="password"
          autoComplete="current-password"
          placeholder={forced ? "Temporary password" : "Current password"}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="passcode-input"
          aria-label="Current password"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder={`New password (min ${PASSWORD_MIN} characters)`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="passcode-input"
          aria-label="New password"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="passcode-input"
          aria-label="Confirm new password"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!current || !next || !confirm || state === "saving" || state === "done"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {state === "saving" ? "Saving…" : "Change password"}
        </button>
      </form>

      {state === "done" && (
        <p style={{ marginBottom: 0, marginTop: 10, fontSize: "var(--font-size-sm)" }}>
          Password changed. Opening the dashboard…
        </p>
      )}

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {message}
        </p>
      )}
    </div>
  );
}
