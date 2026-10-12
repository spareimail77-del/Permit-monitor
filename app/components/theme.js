"use client";

import { useEffect, useState } from "react";

const KEY = "hse-theme";

// The theme is the data-theme attribute on <html>. app/layout.js sets it before
// the page paints, so there is no flash. The choice is kept in this browser only.
export function useTheme() {
  const [theme, setTheme] = useState(null); // null until the browser has told us

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch (e) {
      // Storage blocked: the theme still changes, it just is not remembered.
    }
    setTheme(next);
  }

  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  return { theme, toggle, label };
}

// Shows the theme you would switch TO: a moon on the light theme, a sun on the dark one.
export function ThemeIcon({ theme }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
  if (theme === "light") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  return null;
}
