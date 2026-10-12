"use client";

import { ThemeIcon, useTheme } from "./theme";

// The stand-alone theme button, used where there is no user menu (the sign-in page).
export default function ThemeToggle() {
  const { theme, toggle, label } = useTheme();
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <ThemeIcon theme={theme} />
    </button>
  );
}
