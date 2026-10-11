"use client";

import { useState } from "react";
import { PASSWORD_MAX, PASSWORD_MIN } from "../../lib/authRules";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [state, setState] = useState({ busy: false, error: "" });

  async function submit(e) {
    e.preventDefault();
    if (state.busy) return;
    if (next !== again) return setState({ busy: false, error: "The two new passwords do not match." });
    setState({ busy: true, error: "" });
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ busy: false, error: data.error || "Could not change the password." });
      window.location.href = "/"; // full load, so the lock is gone from the start
    } catch {
      setState({ busy: false, error: "Network error. Try again." });
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <form onSubmit={submit} className="pform" style={{ gap: 14 }}>
      <div className="pform-field">
        <label htmlFor="cp-current">Temporary (current) password</label>
        <input id="cp-current" type="password" className="pform-input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" maxLength={PASSWORD_MAX} autoFocus />
      </div>
      <div className="pform-field">
        <label htmlFor="cp-new">New password</label>
        <input id="cp-new" type="password" className="pform-input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} />
        <p className="pform-hint">At least {PASSWORD_MIN} characters.</p>
      </div>
      <div className="pform-field">
        <label htmlFor="cp-again">New password again</label>
        <input id="cp-again" type="password" className="pform-input" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} />
      </div>
      {state.error && <p className="error-text">{state.error}</p>}
      <div className="pform-actions">
        <button type="submit" className="btn btn-primary" disabled={state.busy || !current || !next || !again}>
          {state.busy ? "Saving…" : "Save new password"}
        </button>
        <button type="button" className="btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    </form>
  );
}
