"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deletes one attachment (Root and HSE; the server checks again).
export default function DeleteFileButton({ permitId, fileId, fileName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    if (!window.confirm(`Delete the file "${fileName}" for good? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/permits/${permitId}/files/${fileId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <span style={{ marginLeft: 10 }}>
      <button type="button" className="pform-link" style={{ color: "var(--danger)" }} onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="error-text" style={{ marginLeft: 8, fontSize: 12 }}>{error}</span>}
    </span>
  );
}
