"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PASSWORD_MAX, PASSWORD_MIN } from "../../lib/authRules";

function Notice({ state }) {
  if (!state.text) return null;
  return <p className={state.error ? "error-text" : "pform-rec"}>{state.text}</p>;
}

export default function ProfileForms({ initialName }) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [nameState, setNameState] = useState({ busy: false, text: "", error: false });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [passState, setPassState] = useState({ busy: false, text: "", error: false });

  async function saveName(e) {
    e.preventDefault();
    if (nameState.busy) return;
    setNameState({ busy: true, text: "", error: false });
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setNameState({ busy: false, text: data.error || "Could not save.", error: true });
      setName(data.displayName);
      setNameState({ busy: false, text: "Name saved.", error: false });
      router.refresh();
    } catch {
      setNameState({ busy: false, text: "Network error. Try again.", error: true });
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (passState.busy) return;
    if (next !== again) return setPassState({ busy: false, text: "The two new passwords do not match.", error: true });
    setPassState({ busy: true, text: "", error: false });
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setPassState({ busy: false, text: data.error || "Could not change the password.", error: true });
      setCurrent("");
      setNext("");
      setAgain("");
      setPassState({ busy: false, text: "Password changed.", error: false });
    } catch {
      setPassState({ busy: false, text: "Network error. Try again.", error: true });
    }
  }

  return (
    <div className="pform">
      <form onSubmit={saveName} className="panel pform-card">
        <h2 className="pform-title">Your name</h2>
        <div className="pform-grid">
          <div className="pform-field">
            <label htmlFor="pr-name">Name shown on the site</label>
            <input id="pr-name" className="pform-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <p className="pform-hint">2 to 40 characters. Your Staff ID is shown if this is empty.</p>
          </div>
        </div>
        <Notice state={nameState} />
        <div className="pform-actions mt-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={nameState.busy || name.trim().length < 2}>
            {nameState.busy ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>

      <form id="change-password" onSubmit={savePassword} className="panel pform-card">
        <h2 className="pform-title">Change password</h2>
        <div className="pform-grid">
          <div className="pform-field">
            <label htmlFor="pw-current">Current password</label>
            <input id="pw-current" type="password" className="pform-input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" maxLength={PASSWORD_MAX} />
          </div>
          <div className="pform-field">
            <label htmlFor="pw-new">New password</label>
            <input id="pw-new" type="password" className="pform-input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} />
            <p className="pform-hint">At least {PASSWORD_MIN} characters.</p>
          </div>
          <div className="pform-field">
            <label htmlFor="pw-again">New password again</label>
            <input id="pw-again" type="password" className="pform-input" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} />
          </div>
        </div>
        <Notice state={passState} />
        <div className="pform-actions mt-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={passState.busy || !current || !next || !again}>
            {passState.busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
