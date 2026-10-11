"use client";

import { useState } from "react";
import { safeNextPath } from "../../lib/authRules";

export default function LoginForm({ next }) {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | error
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (state === "saving") return;
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not sign in.");
        return;
      }
      // A full page load, so the new session cookie is used from the start.
      window.location.href = safeNextPath(next);
    } catch {
      setState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="pform" style={{ gap: 14 }}>
      <div className="pform-field">
        <label htmlFor="li-staff">Staff ID</label>
        <input
          id="li-staff"
          className="pform-input"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={12}
          disabled={state === "saving"}
          autoFocus
        />
      </div>
      <div className="pform-field">
        <label htmlFor="li-pass">Password</label>
        <input
          id="li-pass"
          type="password"
          className="pform-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={72}
          disabled={state === "saving"}
        />
      </div>
      {state === "error" && message && <p className="error-text">{message}</p>}
      <button type="submit" className="btn btn-primary" disabled={state === "saving" || !staffId || !password}>
        {state === "saving" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
