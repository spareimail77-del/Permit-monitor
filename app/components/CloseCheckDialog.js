"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { isNA } from "../../lib/permitRules";
import { closeWithFixes } from "../../lib/closeWithFixes";
import { editImageFile } from "../../lib/editImage";
import { fileProblem, formatBytes } from "../../lib/fileRules";
import "./permits.css";

// "Check before closing": shown when a permit about to be closed still has empty details
// (holder, issuer, area authority) or a certificate without an attached copy.
// See lib/closeCheck.js for the rules. One dialog for every place that closes permits
// (list, permit page, edit form):
//
//   items          [{ id, reference, missing: [{ key, label }], certs: [{ name, number }] }]
//   total          how many permits are being closed (more than items when some are fine)
//   fix            ONE permit only: { options: { holder: [...], issuer: [...] } | null }
//                  turns on fixing right here: pick the names, type the area authority,
//                  choose the certificate copies, then "Save & close" (lib/closeWithFixes.js)
//   onClosed       called after "Save & close" has closed the permit
//   editHref       link to the full edit form (a button, or a small link when fix is on)
//   onEdit         ...or a function instead (the edit form uses it to jump to the field)
//   onConfirm      "Close anyway" (without saving anything typed here)
//   onPartial      several permits: "Close only the ones without problems"
//   onCancel       Cancel, Escape, or a click outside
//
// Several permits: each one lists what it lacks and has its own Edit link (new tab,
// so the chosen permits stay chosen). Fixing inline is for one permit at a time.

const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const Warn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
    <path d="M12 10v4.5M12 17.4v.1" />
  </svg>
);

const certText = (c) => `${c.name}${c.number && !isNA(c.name) ? ` · no. ${c.number}` : ""}`;

// The two groups of chips for one permit (read-only view).
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
  fix,
  onClosed,
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
  const [values, setValues] = useState({ holder: "", issuer: "", areaAuthority: "" });
  const [files, setFiles] = useState({}); // certificate name -> File
  const [fileErr, setFileErr] = useState({});
  const [doneCerts, setDoneCerts] = useState(() => new Set()); // copies already added
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setMounted(true), []);

  // The safe choice gets the focus first (once, not on every re-render).
  useEffect(() => {
    if (mounted) safeRef.current?.focus();
  }, [mounted]);

  const locked = busy || saving;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !locked && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [locked, onCancel]);

  if (!mounted || !items || items.length === 0) return null;

  const single = items.length === 1 && total === 1;
  const first = items[0];
  const fixing = single && Boolean(fix);
  const options = fix?.options || null;
  const hasFields = items.some((i) => (i.missing || []).length > 0);
  const hasCerts = items.some((i) => (i.certs || []).length > 0);
  const canEdit = single && !fixing && (editHref || onEdit);
  const label = editLabel || (hasFields ? "Edit permit" : "Add certificate");

  let title;
  let intro;
  if (single) {
    title = hasFields && hasCerts ? `Check permit ${first.reference} before closing` : hasCerts ? `Permit ${first.reference}: certificate copy missing` : `Permit ${first.reference} has empty details`;
    if (fixing) {
      intro = "Fill in what you can below and press Save & close, or close the permit as it is.";
    } else {
      intro =
        hasFields && hasCerts
          ? "Some details are empty and a certificate copy is not attached. Fix them first, or close the permit as it is."
          : hasCerts
            ? "A certificate copy has not been attached yet. Add it first, or close the permit as it is."
            : "These details are still empty. Fill them in first, or close the permit as it is.";
    }
  } else {
    title = `${items.length} of ${total} permits need a check`;
    intro = "These permits have empty details or a certificate copy that is not attached. Open one to fix it, or close them as they are.";
  }

  // ---- fixing right here (one permit) -----------------------------------------------
  const certsLeft = (first.certs || []).filter((c) => !doneCerts.has(c.name));
  const hasInput = Object.values(values).some((v) => String(v).trim() !== "") || Object.values(files).some(Boolean);
  const canSave = hasInput || doneCerts.size > 0;

  function setValue(key, v) {
    setValues((x) => ({ ...x, [key]: v }));
    setError("");
  }

  async function pickFile(name, picked) {
    if (!picked) return;
    setFileErr((e) => ({ ...e, [name]: undefined }));
    const file = await editImageFile(picked); // photos open the crop / compress editor
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) return setFileErr((e) => ({ ...e, [name]: problem }));
    setFiles((f) => ({ ...f, [name]: file }));
    setError("");
  }

  async function saveAndClose() {
    if (locked || !canSave) return;
    setSaving(true);
    setError("");
    const res = await closeWithFixes(first.id, { values, files });
    if (res.done && res.done.length > 0) {
      // These copies are on the permit now: do not send them again on a retry.
      setDoneCerts((prev) => new Set([...prev, ...res.done]));
      setFiles((f) => {
        const next = { ...f };
        for (const name of res.done) delete next[name];
        return next;
      });
    }
    setSaving(false);
    if (res.ok) onClosed?.();
    else setError(res.error || "That did not work.");
  }

  function fieldControl(m) {
    const list = options && Array.isArray(options[m.key]) ? options[m.key] : null;
    const id = `cc-f-${m.key}`;
    if (m.key === "areaAuthority") {
      return (
        <input id={id} className="pform-input" value={values.areaAuthority} onChange={(e) => setValue("areaAuthority", e.target.value)} disabled={locked} maxLength={120} placeholder="Name, or NA if none" />
      );
    }
    if (list && list.length > 0) {
      return (
        <select id={id} className="pform-input" value={values[m.key]} onChange={(e) => setValue(m.key, e.target.value)} disabled={locked}>
          <option value="">Select…</option>
          {list.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return <p className="pform-hint">{options ? "No names in this list yet. Add them on the Lists page." : "The list could not be loaded. Use the full edit form."}</p>;
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !locked && onCancel()}>
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

        {fixing ? (
          <div className="cc-fix">
            {(first.missing || []).length > 0 && <p className="cc-label">Empty details</p>}
            {(first.missing || []).map((m) => (
              <div key={m.key} className="cc-field">
                <label htmlFor={`cc-f-${m.key}`}>{m.label}</label>
                {fieldControl(m)}
              </div>
            ))}

            {certsLeft.length > 0 && <p className="cc-label">Certificate copy not attached</p>}
            {certsLeft.map((c) => {
              const file = files[c.name];
              return (
                <div key={c.name} className="cc-cert">
                  <span className="cc-cert__name">{certText(c)}</span>
                  {file ? (
                    <span className="cc-file">
                      <span className="cc-file__n" title={file.name}>
                        {file.name}
                      </span>
                      <span className="cc-file__s">{formatBytes(file.size)}</span>
                      <button type="button" className="pform-link" disabled={locked} onClick={() => setFiles((f) => ({ ...f, [c.name]: undefined }))}>
                        Remove
                      </button>
                    </span>
                  ) : (
                    <label className={`btn btn-sm cc-pick${locked ? " is-disabled" : ""}`}>
                      <input
                        type="file"
                        accept={FILE_ACCEPT}
                        className="sr-only"
                        disabled={locked}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          e.target.value = "";
                          pickFile(c.name, f);
                        }}
                      />
                      Choose file
                    </label>
                  )}
                  {fileErr[c.name] && <p className="pform-error cc-cert__err">{fileErr[c.name]}</p>}
                </div>
              );
            })}
            {doneCerts.size > 0 && <p className="cc-ok">Added: {[...doneCerts].join(", ")}</p>}

            {error && (
              <p className="pform-error cc-error" role="alert">
                {error}
              </p>
            )}
            {editHref && (
              <Link href={editHref} className="cc-fulledit">
                Open the full edit form instead →
              </Link>
            )}
          </div>
        ) : single ? (
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
          <button ref={single && !fixing ? null : safeRef} type="button" className="btn" disabled={locked} onClick={onCancel}>
            Cancel
          </button>
          {onPartial && partialLabel && (
            <button type="button" className="btn" disabled={locked} onClick={onPartial}>
              {partialLabel}
            </button>
          )}
          <button type="button" className="btn cc-warn" disabled={locked} onClick={onConfirm}>
            {busy ? "Working…" : fixing && hasInput ? "Close without saving" : confirmLabel}
          </button>
          {fixing && (
            <button type="button" className="btn btn-primary" disabled={locked || !canSave} onClick={saveAndClose}>
              {saving ? "Saving…" : "Save & close"}
            </button>
          )}
          {canEdit &&
            (editHref ? (
              <Link ref={safeRef} href={editHref} className="btn btn-primary">
                {label}
              </Link>
            ) : (
              <button ref={safeRef} type="button" className="btn btn-primary" disabled={locked} onClick={onEdit}>
                {label}
              </button>
            ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
