"use client";

// A plain <input type="password"> plus a show/hide toggle. Everything
// here is client-side state (just the input's `type` attribute) — no
// network call, no server change. Forwards every other prop straight
// to the <input>, so it's a drop-in replacement for the old
// `<input type="password" className="passcode-input" ... />` fields.

import { useId, useState } from "react";
import Icon from "./Icon";

export default function PasswordInput({ className = "passcode-input", ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const reactId = useId();
  const describedById = `pw-toggle-${reactId}`;

  return (
    <div className="password-field">
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={`${className} password-field__input`}
      />
      <button
        type="button"
        className="password-field__toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-describedby={describedById}
        onClick={() => setVisible((v) => !v)}
        // Password managers and browser autofill sometimes treat any
        // button inside a form as submit-adjacent; keep this one from
        // ever being reachable as a submit trigger.
        tabIndex={0}
      >
        <span className="password-field__icon-stack">
          <span className={`password-field__icon ${visible ? "" : "password-field__icon--active"}`}>
            <Icon name="eyeOff" size={18} />
          </span>
          <span className={`password-field__icon ${visible ? "password-field__icon--active" : ""}`}>
            <Icon name="eye" size={18} />
          </span>
        </span>
      </button>
      <span id={describedById} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {visible ? "Password is visible" : "Password is hidden"}
      </span>
    </div>
  );
}
