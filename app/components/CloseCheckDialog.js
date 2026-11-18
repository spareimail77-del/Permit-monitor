"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import "./permits.css";

// "Some details are empty": shown before a permit is closed when holder, issuer or
// area authority is still empty (see lib/closeCheck.js for which fields).
// One dialog for every place that closes permits (list, permit page, edit form):
//
//   items          [{ id, reference, missing: [{ key, label }] }]  the permits with empty fields
//   total          how many permits are being closed (more than items when some are complete)
//   editHref       one permit: the "Edit permit" button is a link to its edit page
//   onEdit         ...or a function instead (the edit form uses it to jump to the field)
//   onConfirm      "Close anyway"
//   onPartial      several permits: "Close only the complete ones" (shown when there are any)
//   onCancel       Cancel, Escape, or a click outside
//
// Several permits: each one lists its empty fields and has its own Edit link (new tab,
// so the chosen permits stay chosen).

const Warn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
    <path d="M12 10v4.5M12 17.4v.1" />
  </svg>
);

export default function CloseCheckDialog({
  items,
  total = 1,
  editHref,
  onEdit,
  editLabel = "Edit permit",
  confirmLabel = "Close anyway",
  onConfirm,
  partialLabel,
  onPartial,
  busy = false,
  onCancel,
}) {
  const [mounted, setMounted] = useState(false);
  const safeRef = useRef(null);
  useEffect(() => setMounted(true), []);

  // The safe choice gets the focus first (once, not on every re-render).
  useEffect(() => {
    if (mounted) safeRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  if (!mounted || !items || items.length === 0) return null;

  const single = items.length === 1 && total === 1;
  const first = items[0];
  const canEdit = single && (editHref || onEdit);
  const title = single ? `Permit ${first.reference} has empty details` : `${items.length} of ${total} permits have empty details`;
  const intro = single
    ? "These details are still empty. Fill them in first, or close the permit as it is."
    : "These permits are missing details. Open one to fill it in, or close them as they are.";

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog cc-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-title" aria-describedby="cc-intro">
        <div className="cc-head">
          <span className="cc-icon">
            <Warn />
          </span>
          <h2 id="cc-title" className="dialog__title">
            {title}
          </h2>
        </div>
        <p id="cc-intro" className="dialog__body">
          {intro}
        </p>

        {single ? (
          <ul className="cc-chips" aria-label="Empty details">
            {first.missing.map((m) => (
              <li key={m.key} className="cc-chip">
                {m.label}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="cc-list">
            {items.map((it) => (
              <li key={it.id} className="cc-item">
                <div className="cc-item__top">
                  <span className="cc-ref mono">{it.reference}</span>
                  <Link href={`/permits/edit/${it.id}`} target="_blank" rel="noopener" className="cc-edit">
                    Edit ↗
                  </Link>
                </div>
                <ul className="cc-chips">
                  {it.missing.map((m) => (
                    <li key={m.key} className="cc-chip">
                      {m.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className="cc-actions">
          <button ref={single ? null : safeRef} type="button" className="btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          {onPartial && partialLabel && (
            <button type="button" className="btn" disabled={busy} onClick={onPartial}>
              {partialLabel}
            </button>
          )}
          <button type="button" className="btn cc-warn" disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
          {canEdit &&
            (editHref ? (
              <Link ref={safeRef} href={editHref} className="btn btn-primary">
                {editLabel}
              </Link>
            ) : (
              <button ref={safeRef} type="button" className="btn btn-primary" disabled={busy} onClick={onEdit}>
                {editLabel}
              </button>
            ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
