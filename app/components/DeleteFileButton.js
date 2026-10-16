"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";

// Deletes one attachment (Root and HSE; the server checks again).
export default function DeleteFileButton({ permitId, fileId, fileName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/permits/${permitId}/files/${fileId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
    setOpen(false);
  }

  return (
    <span className="inline-action">
      <button type="button" className="btn btn-sm btn--danger-outline" onClick={() => setOpen(true)} disabled={busy}>
        Delete
      </button>
      {error && <span className="error-text error-text--sm ml-2">{error}</span>}
      <ConfirmDialog
        open={open}
        title="Delete this file?"
        body={`“${fileName}” will be deleted for good. This cannot be undone.`}
        confirmLabel="Delete file"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </span>
  );
}
