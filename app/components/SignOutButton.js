"use client";

import { useState } from "react";
import { clearCounts } from "./useAdminCounts";

// The last item of the user menu.
export default function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    clearCounts();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // A full page load, so nothing from the old session stays on screen.
      window.location.href = "/login";
    }
  }

  return (
    <button type="button" role="menuitem" tabIndex={-1} className="menu-item menu-item--danger" onClick={signOut} disabled={busy}>
      <span className="menu-item__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
        </svg>
      </span>
      <span className="menu-item__text">{busy ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
