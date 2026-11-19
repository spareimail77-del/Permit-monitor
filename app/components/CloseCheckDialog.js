"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { isNA } from "../../lib/permitRules";
import "./permits.css";

// "Check before closing": shown when a permit about to be closed still has empty details
// (holder, issuer, area authority) or a certificate without an attached copy.
// See lib/closeCheck.js for the rules. One dialog for every place that closes permits
// (list, permit page, edit form):
//
//   items          [{ id, reference, missing: [{ key, label }], certs: [{ name, number }] }]
//   total          how many permits are being closed (more than items when some are fine)
//   editHref       one permit: the main button is a link to its edit page
//   onEdit         ...or a function instead (the edit form uses it to jump to the field)
//   onConfirm      "Close anyway"
//   onPartial      several permits: "Close only the ones without problems"
//   onCancel       Cancel, Escape, or a click outside
//
// Several permits: each one lists what it lacks and has its own Edit link (new tab,
// so the chosen permits stay chosen).

const Warn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
    <path d="M12 10v4.5M12 17.4v.1" />
  </svg>
);

const certText = (c) => `${c.name}${c.number && !isNA(c.name) ? ` · no. ${c.number}` : ""}`;

// The two groups of chips for one permit.
function Problems({ item }) {
  const fields = item.missing || [];
  const certs = item.certs || [];
  return (
    <>
      {fields.length > 0 && (
        <>
          <p className="cc-label">Empty details</p>
          <ul className="cc-chips">
            {fields.map((m) => (
              <li key={m.key} className="cc-chip">
                {m.label}
              </li>
            ))}
          </ul>
        </>
      )}
      {certs.length > 0 && (
        <>
          <p className="cc-label">Certificate copy not attached</p>
          <ul className="cc-chips">
            {certs.map((c) => (
              <li key={c.name} className="cc-chip cc-chip--cert">
                {certText(c)}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function CloseCheckDialog({
  items,
  total = 1,
  editHref,
  onEdit,
  editLabel,
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
  const hasFields = items.some((i) => (i.missing || []).length > 0);
  const hasCerts = items.some((i) => (i.certs || []).length > 0);
  const canEdit = single && (editHref || onEdit);
  const label = editLabel || (hasFields ? "Edit permit" : "Add certificate");

  let title;
  let intro;
  if (single) {
    title = hasFields && hasCerts ? `Check permit ${first.reference} before closing` : hasCerts ? `Permit ${first.reference}: certificate copy missing` : `Permit ${first.reference} has empty details`;
    intro =
      hasFields && hasCerts
        ? "Some details are empty and a certificate copy is not attached. Fix them first, or close the permit as it is."
        : hasCerts
          ? "A certificate copy has not been attached yet. Add it first, or close the permit as it is."
          : "These details are still empty. Fill them in first, or close the permit as it is.";
  } else {
    title = `${items.length} of ${total} permits need a check`;
    intro = "These permits have empty details or a certificate copy that is not attached. Open one to fix it, or close them as they are.";
  }

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
          <div className="cc-group">
            <Problems item={first} />
          </div>
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
                <Problems item={it} />
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
                {label}
              </Link>
            ) : (
              <button ref={safeRef} type="button" className="btn btn-primary" disabled={busy} onClick={onEdit}>
                {label}
              </button>
            ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
