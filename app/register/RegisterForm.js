"use client";

import { useState } from "react";
import Link from "next/link";
import { PASSWORD_MAX, PASSWORD_MIN } from "../../lib/authRules";

export default function RegisterForm() {
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [trap, setTrap] = useState(""); // hidden field: only bots fill it
  const [state, setState] = useState("idle"); // idle | saving | error | done
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (state === "saving") return;
    if (password !== again) {
      setState("error");
      setMessage("The two passwords do not match.");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, displayName: name, password, website: trap }),
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
          Request sent. You can sign in once Root has approved it. Please tell Root you have asked.
        </div>
        <Link href="/login" className="btn btn-primary">
          Go to sign in
        </Link>
      </div>
    );
  }

  const busy = state === "saving";
  return (
    <form onSubmit={submit} className="pform" style={{ gap: 14 }}>
      <div className="pform-field">
        <label htmlFor="rg-staff">Staff ID</label>
        <input id="rg-staff" className="pform-input" value={staffId} onChange={(e) => setStaffId(e.target.value)} autoComplete="username" autoCapitalize="none" maxLength={12} disabled={busy} autoFocus />
        <p className="pform-hint">3 to 12 letters or digits.</p>
      </div>
      <div className="pform-field">
        <label htmlFor="rg-name">Your name</label>
        <input id="rg-name" className="pform-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} disabled={busy} />
      </div>
      <div className="pform-field">
        <label htmlFor="rg-pass">Choose a password</label>
        <input id="rg-pass" type="password" className="pform-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} disabled={busy} />
        <p className="pform-hint">At least {PASSWORD_MIN} characters.</p>
      </div>
      <div className="pform-field">
        <label htmlFor="rg-again">Password again</label>
        <input id="rg-again" type="password" className="pform-input" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} disabled={busy} />
      </div>
      {/* Bot trap: hidden from people. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
        <label htmlFor="rg-web">Website</label>
        <input id="rg-web" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>
      {state === "error" && message && <p className="error-text">{message}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || !staffId || !name || !password || !again}>
        {busy ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
