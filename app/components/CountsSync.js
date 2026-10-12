"use client";

import { useEffect } from "react";
import { storeCounts } from "./useAdminCounts";

// Rendered on the Admin pages, which already read the live counts. It saves them
// for the user menu, so the menu is up to date after Root opens an Admin page or
// acts on a request there.
export default function CountsSync({ counts }) {
  const ready = counts && typeof counts.pendingUsers === "number";
  const a = ready ? counts.pendingUsers : 0;
  const b = ready ? counts.passwordRequests : 0;
  const c = ready ? counts.idChanges : 0;
  useEffect(() => {
    if (ready) storeCounts({ pendingUsers: a, passwordRequests: b, idChanges: c });
  }, [ready, a, b, c]);
  return null;
}
