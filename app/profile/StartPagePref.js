"use client";

import { useEffect, useState } from "react";

const KEY = "permit-log-start-mine";

// "Open the Permit List on My permits" - a device preference. Only offered
// to people whose account is linked to a name in the permit log.
export default function StartPagePref({ hasLinks }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(KEY) === "1");
    } catch (err) {
      setOn(false);
    }
  }, []);

  function toggle(e) {
    const value = e.target.checked;
    setOn(value);
    try {
      if (value) window.localStorage.setItem(KEY, "1");
      else window.localStorage.removeItem(KEY);
    } catch (err) {
      // storage unavailable - the choice just won't persist
    }
  }

  return (
    <div className="panel pf-card">
      <h3 className="pf-card__title">Permit List</h3>
      <label className={`pf-switch${hasLinks ? "" : " is-disabled"}`}>
        <input type="checkbox" checked={on && hasLinks} disabled={!hasLinks} onChange={toggle} />
        <span className="pf-switch__track" aria-hidden="true">
          <span className="pf-switch__thumb" />
        </span>
        <span>
          <span className="pf-switch__label">Open the Permit List on My permits</span>
          <span className="pf-switch__hint">
            {hasLinks
              ? "When you open the list without a filter. Saved on this device."
              : "Available once HSE links your name in the permit log."}
          </span>
        </span>
      </label>
    </div>
  );
}
