"use client";

import { useState } from "react";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";
import { PASSWORD_MIN, passwordProblem } from "../../lib/authRules";

// Change password, inside My profile -> Security. Same rules and same server
// route as before; after a success the fields are cleared and a message is
// shown (no page reload, the person stays where they are).
export default function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | error | done
  const [message, setMessage] = useState("");

  const lengthOk = !passwordProblem(next);
  const matches = confirm.length > 0 && next === confirm;
  const canSubmit = current && lengthOk && matches && state !== "saving";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
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
      setCurrent("");
      setNext("");
      setConfirm("");
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  function edited(setter) {
    return (e) => {
      setter(e.target.value);
      if (state === "done" || state === "error") setState("idle");
    };
  }

  return (
    <div className="panel pf-card">
      <h3 className="pf-card__title">Change password</h3>
      <p className="pf-card__sub">Enter your current password, then choose a new one.</p>

      <form onSubmit={handleSubmit} className="pf-form">
        <PasswordInput
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={edited(setCurrent)}
          aria-label="Current password"
        />
        <PasswordInput
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={edited(setNext)}
          aria-label="New password"
        />
        <PasswordInput
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={edited(setConfirm)}
          aria-label="Confirm new password"
        />

        <ul className="pf-checks" aria-label="Password checks">
          <li className={lengthOk ? "is-ok" : ""}>
            <Icon name={lengthOk ? "checkCircle" : "clock"} size={14} />
            At least {PASSWORD_MIN} characters
          </li>
          <li className={matches ? "is-ok" : ""}>
            <Icon name={matches ? "checkCircle" : "clock"} size={14} />
            Both new passwords match
          </li>
        </ul>

        <div className="pf-inline-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {state === "saving" && <span className="btn-spinner" aria-hidden="true" />}
            {state === "saving" ? "Saving…" : "Change password"}
          </button>
        </div>

        <div aria-live="polite">
          {state === "done" && (
            <p className="pf-ok">
              <Icon name="checkCircle" size={14} /> Password changed. Use it the next time you sign in.
            </p>
          )}
          {state === "error" && <p className="error-text">{message}</p>}
        </div>
      </form>
    </div>
  );
}
