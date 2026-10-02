"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  { id: "dark", label: "Dark", hint: "Easy on the eyes at night" },
  { id: "light", label: "Light", hint: "Bright, for daytime" },
  { id: "system", label: "Follow my device", hint: "Switches with your phone or PC" },
];

function effectiveTheme(choice) {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// Dark / Light / Follow my device. Saved on this device; the header switch
// keeps working (it sets an explicit Dark or Light).
export default function ThemePicker() {
  const [choice, setChoice] = useState("dark");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("permit-log-theme");
      setChoice(stored === "light" || stored === "system" ? stored : "dark");
    } catch (err) {
      setChoice("dark");
    }
  }, []);

  // While "Follow my device" is chosen on this page, follow live changes.
  useEffect(() => {
    if (choice !== "system" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      document.documentElement.setAttribute("data-theme", mq.matches ? "light" : "dark");
      window.dispatchEvent(new Event("permit:theme-changed"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function pick(id) {
    setChoice(id);
    try {
      window.localStorage.setItem("permit-log-theme", id);
    } catch (err) {
      // storage can fail in locked-down browsers - the choice just won't persist
    }
    document.documentElement.setAttribute("data-theme", effectiveTheme(id));
    window.dispatchEvent(new Event("permit:theme-changed"));
  }

  return (
    <div className="panel pf-card">
      <h3 className="pf-card__title">Theme</h3>
      <p className="pf-card__sub">Saved on this device.</p>
      <div className="pf-themes" role="radiogroup" aria-label="Theme">
        {OPTIONS.map((o) => (
          <label key={o.id} className={`pf-theme${choice === o.id ? " is-selected" : ""}`}>
            <input
              type="radio"
              name="theme"
              value={o.id}
              checked={choice === o.id}
              onChange={() => pick(o.id)}
            />
            <span className={`pf-theme__preview pf-theme__preview--${o.id}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="pf-theme__label">{o.label}</span>
            <span className="pf-theme__hint">{o.hint}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
