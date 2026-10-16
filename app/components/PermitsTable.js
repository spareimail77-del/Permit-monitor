"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";

// The permit list table. Everyone sees the rows; only Root and HSE (canManage) get the
// checkboxes, the row menu, the bottom bar and the delete / close actions. The server
// checks the permission again in /api/permits/bulk, so hiding buttons is not the lock.
const MAX = 200; // the same limit as the server

const fmt = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const Clip = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l8.5-8.5a3.7 3.7 0 015.2 5.2l-8.5 8.5a1.8 1.8 0 01-2.6-2.6l7.8-7.8" />
  </svg>
);

export default function PermitsTable({ rows, columns, canManage, canExport }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set());
  const [menu, setMenu] = useState(null); // { id, left, top?, bottom? }
  const [dialog, setDialog] = useState(null); // { action, ids }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // { text, error, undo: { action, ids } }
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef(null);
  const headCheck = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => setMounted(true), []);

  // After a refresh (or a filter change) forget selected permits that are no longer listed.
  useEffect(() => {
    const present = new Set(rows.map((r) => r.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const limit = Math.min(rows.length, MAX);
  const allChecked = selectedRows.length > 0 && selectedRows.length === limit;
  useEffect(() => {
    if (headCheck.current) headCheck.current.indeterminate = selectedRows.length > 0 && !allChecked;
  }, [selectedRows.length, allChecked]);

  // The toast goes away by itself (errors a bit sooner).
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.error ? 6000 : 10000);
    return () => clearTimeout(t);
  }, [toast]);

  // The row menu closes on an outside click, Escape, scrolling or resizing.
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest("[data-menu-btn]")) return;
      close();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    menuRef.current?.querySelector("a, button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  // The confirmation dialog: Escape closes it, the safe button has the focus.
  useEffect(() => {
    if (!dialog) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && !busy && setDialog(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, busy]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= MAX) setToast({ text: `You can choose at most ${MAX} permits at a time.`, error: true });
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else {
      setSelected(new Set(rows.slice(0, MAX).map((r) => r.id)));
      if (rows.length > MAX) setToast({ text: `The first ${MAX} permits were chosen (the limit for one action).`, error: true });
    }
  }

  function openMenu(e, r) {
    if (menu && menu.id === r.id) return setMenu(null);
    const b = e.currentTarget.getBoundingClientRect();
    const w = 190;
    const left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8));
    const room = window.innerHeight - b.bottom;
    setMenu(room < 190 ? { id: r.id, left, bottom: window.innerHeight - b.top + 4 } : { id: r.id, left, top: b.bottom + 4 });
  }

  // Close and trash ask first. Close only counts the permits that are really open.
  function ask(action, list) {
    setMenu(null);
    const ids = (action === "close" ? list.filter((r) => r.status === "OPEN") : list).map((r) => r.id);
    if (ids.length === 0) return setToast({ text: "None of the chosen permits is open, so there is nothing to close.", error: true });
    setDialog({ action, ids, refs: list.filter((r) => ids.includes(r.id)).map((r) => r.reference) });
  }

  async function run(action, ids, { undoable = true } = {}) {
    setBusy(true);
    try {
      const res = await fetch("/api/permits/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ text: data.error || "That did not work.", error: true });
        return;
      }
      const n = data.changed.length;
      if (n === 0) {
        setToast({ text: "Nothing was changed. The permits may have been changed by someone else.", error: true });
      } else {
        const skipped = data.skipped > 0 ? ` ${data.skipped} skipped.` : "";
        const text = {
          trash: `${plural(n, "permit", "permits")} moved to the trash.`,
          close: `${plural(n, "permit", "permits")} closed.`,
          restore: `${plural(n, "permit", "permits")} restored from the trash.`,
          reopen: `${plural(n, "permit", "permits")} reopened.`,
        }[action];
        const undoAction = action === "trash" ? "restore" : action === "close" ? "reopen" : "";
        setToast({ text: text + skipped, undo: undoable && undoAction ? { action: undoAction, ids: data.changed } : null });
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setToast({ text: "Network error. Try again.", error: true });
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  const dialogText = dialog && {
    trash: {
      title: `Move ${plural(dialog.ids.length, "permit", "permits")} to the trash?`,
      body: "Nothing is erased. You can press Undo right after, and Root or HSE can restore them later from the Trash page.",
      go: "Move to trash",
      danger: true,
    },
    close: {
      title: `Close ${plural(dialog.ids.length, "permit", "permits")}?`,
      body: "Today's date (Oman time) is saved as the closed date. Permits that are not open are left out.",
      go: "Close permits",
      danger: false,
    },
  }[dialog.action];

  const menuRow = menu && rows.find((r) => r.id === menu.id);

  return (
    <>
      <table className={`table table--rows table--cards${canManage ? " table--select" : ""}`}>
        <thead>
          <tr>
            {canManage && (
              <th className="col-check">
                <label className="row-check" title={allChecked ? "Clear selection" : `Select all${rows.length > MAX ? ` (first ${MAX})` : ""}`}>
                  <input ref={headCheck} type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all permits in the list" />
                </label>
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} aria-sort={c.active ? (c.dir === "desc" ? "descending" : "ascending") : undefined}>
                <Link href={c.href} className={`th-sort${c.active ? " is-active" : ""}`} title={`Sort by ${c.label}`}>
                  {c.label}
                  <span className="th-sort__arrow" aria-hidden="true">{c.active ? (c.dir === "desc" ? "▼" : "▲") : "↕"}</span>
                </Link>
              </th>
            ))}
            {canManage && (
              <th className="col-menu">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`row-link row-link--${r.st.key}${selected.has(r.id) ? " row-selected" : ""}`}>
              {canManage && (
                <td className="col-check" data-label="Select">
                  <label className="row-check">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select permit ${r.reference}`} />
                  </label>
                </td>
              )}
              <td className="mono" data-label="Permit no.">
                <Link href={`/permits/${r.id}`} className="row-link__a" aria-label={`Open permit ${r.reference}`}>
                  {r.reference}
                </Link>
              </td>
              <td data-label="Area">{r.area || "—"}</td>
              <td data-label="Location">{r.location || "—"}</td>
              <td data-label="Type">{r.permit_type || "—"}</td>
              <td data-label="Applicant">{r.applicant || "—"}</td>
              <td data-label="Holder">{r.holder || "—"}</td>
              <td className="mono" data-label="From">{fmt(r.valid_from)}</td>
              <td className="mono" data-label="To">{fmt(r.valid_to)}</td>
              <td data-label="Files">
                {r.fileCount === undefined ? (
                  "—"
                ) : (
                  <span className="attach-cell">
                    <Link
                      href={`/permits/${r.id}`}
                      className={`attach${r.fileCount ? "" : " attach--none"}`}
                      title={r.fileCount ? `Attached: ${r.fileTip}` : "No files attached"}
                      aria-label={r.fileCount ? `${r.fileCount} attached: ${r.fileTip}` : "No files attached"}
                    >
                      <Clip />
                      <span>{r.fileCount}</span>
                    </Link>
                  </span>
                )}
              </td>
              <td data-label="Status">
                <StatusBadge status={r.st} showDetail />
              </td>
              {canManage && (
                <td className="col-menu" data-label="Actions">
                  <button
                    type="button"
                    className="row-menu-btn"
                    data-menu-btn
                    aria-haspopup="menu"
                    aria-expanded={menu?.id === r.id}
                    aria-label={`Actions for permit ${r.reference}`}
                    onClick={(e) => openMenu(e, r)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="12" cy="19" r="1.8" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {mounted &&
        createPortal(
          <>
            {menu && menuRow && (
              <div ref={menuRef} className="row-menu" role="menu" style={{ left: menu.left, top: menu.top, bottom: menu.bottom }}>
                <Link href={`/permits/${menuRow.id}`} role="menuitem" className="row-menu__item">View</Link>
                <Link href={`/permits/edit/${menuRow.id}`} role="menuitem" className="row-menu__item">Edit</Link>
                {menuRow.status === "OPEN" && (
                  <button type="button" role="menuitem" className="row-menu__item" onClick={() => ask("close", [menuRow])}>
                    Close permit
                  </button>
                )}
                <button type="button" role="menuitem" className="row-menu__item row-menu__item--danger" onClick={() => ask("trash", [menuRow])}>
                  Move to trash
                </button>
              </div>
            )}

            {canManage && selectedRows.length > 0 && (
              <div className="bulk-bar" role="region" aria-label="Actions for the chosen permits">
                <strong className="bulk-bar__n">{selectedRows.length} selected</strong>
                {selectedRows.some((r) => r.status === "OPEN") && (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => ask("close", selectedRows)}>
                    Close
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => ask("trash", selectedRows)}>
                  Move to trash
                </button>
                {canExport && (
                  <a className="btn btn-sm" href={`/api/export?ids=${selectedRows.map((r) => r.id).join(",")}`}>
                    Export selected
                  </a>
                )}
                <button type="button" className="btn btn-sm bulk-bar__clear" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </div>
            )}

            {dialog && dialogText && (
              <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && setDialog(null)}>
                <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
                  <h2 id="dlg-title" className="dialog__title">{dialogText.title}</h2>
                  <p className="dialog__body">{dialogText.body}</p>
                  <ul className="dialog__list mono">
                    {dialog.refs.slice(0, 5).map((ref) => (
                      <li key={ref}>{ref}</li>
                    ))}
                    {dialog.refs.length > 5 && <li className="dialog__more">and {dialog.refs.length - 5} more</li>}
                  </ul>
                  <div className="dialog__actions">
                    <button ref={cancelRef} type="button" className="btn" disabled={busy} onClick={() => setDialog(null)}>
                      Cancel
                    </button>
                    <button type="button" className={`btn ${dialogText.danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={() => run(dialog.action, dialog.ids)}>
                      {busy ? "Working…" : dialogText.go}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {toast && (
              <div className={`toast${toast.error ? " toast--error" : ""}`} role={toast.error ? "alert" : "status"} aria-live="polite">
                <span>{toast.text}</span>
                {toast.undo && (
                  <button type="button" className="toast__undo" disabled={busy} onClick={() => run(toast.undo.action, toast.undo.ids, { undoable: false })}>
                    Undo
                  </button>
                )}
                <button type="button" className="toast__x" aria-label="Dismiss" onClick={() => setToast(null)}>
                  ×
                </button>
              </div>
            )}
          </>,
          document.body
        )}
      {canManage && selectedRows.length > 0 && <div className="bulk-spacer" aria-hidden="true" />}
    </>
  );
}
