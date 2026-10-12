"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotForm() {
  const [staffId, setStaffId] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | error | done
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (state === "saving") return;
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, website: trap }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not send the request.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  }

  if (state === "done") {
    return (
      <div>
        <div className="notice notice--ok">
          If that Staff ID has an active account, Root now sees your request. Ask Root for your temporary password,
          then sign in with it. You will be asked to choose a new one.
        </div>
        <Link href="/login" className="btn btn-primary">
          Go to sign in
        </Link>
      </div>
    );
  }

  const busy = state === "saving";
  return (
    <form onSubmit={submit} className="pform pform--tight">
      <div className="pform-field">
        <label htmlFor="fp-staff">Staff ID</label>
        <input id="fp-staff" className="pform-input" value={staffId} onChange={(e) => setStaffId(e.target.value)} autoComplete="username" autoCapitalize="none" maxLength={12} disabled={busy} autoFocus />
      </div>
      <div aria-hidden="true" className="hp">
        <label htmlFor="fp-web">Website</label>
        <input id="fp-web" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>
      {state === "error" && message && <p className="error-text">{message}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || !staffId}>
        {busy ? "Sending…" : "Ask Root for a new password"}
      </button>
    </form>
  );
}
