"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown on the page of a permit that is in the trash. Restore: Root and HSE.
// Delete for good: Root only (the server and the database check again).
export default function TrashActions({ permitId, reference, canPurge }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(url, okRedirect) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: permitId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That did not work.");
        setBusy(false);
        return;
      }
      if (okRedirect) window.location.href = okRedirect;
      else {
        router.refresh();
        setBusy(false);
      }
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="notice notice--danger" style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: 0 }}>
        <strong>This permit is in the trash.</strong> It is read-only until it is restored.
      </p>
      <div className="row-actions">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => call("/api/trash/restore")}>
          {busy ? "Working…" : "Restore permit"}
        </button>
        {canPurge && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete permit ${reference} and all its documents for good? This cannot be undone.`)) {
                call("/api/trash/purge", "/trash");
              }
            }}
          >
            Delete for good
          </button>
        )}
      </div>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
