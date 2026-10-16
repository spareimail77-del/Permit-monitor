"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A proper confirmation dialog instead of the browser popup. Escape or a click outside
// cancels (unless busy); the safe button gets the focus first.
export default function ConfirmDialog({ open, title, body, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <h2 id="cd-title" className="dialog__title">{title}</h2>
        {body && <p className="dialog__body">{body}</p>}
        <div className="dialog__actions">
          <button ref={cancelRef} type="button" className="btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
