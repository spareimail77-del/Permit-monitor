"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

export default function ThemeToggle() {
  // Start as "dark" for SSR/first paint; the inline script in layout.js
  // already set the real attribute before hydration, so we just read
  // it back once mounted to keep this control in sync.
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("permit-log-theme", next);
    } catch (err) {
      // Storage can fail in locked-down browsers — theme just won't
      // persist across visits, which is fine.
    }
  }

  return (
    <button
      type="button"
      className="theme-switch"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "light"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-switch__thumb">
        <Icon name={theme === "dark" ? "moon" : "sun"} size={13} />
      </span>
    </button>
  );
}
