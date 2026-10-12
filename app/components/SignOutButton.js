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
    <button type="button" role="menuitem" tabIndex={-1} className="menu-item" onClick={signOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
