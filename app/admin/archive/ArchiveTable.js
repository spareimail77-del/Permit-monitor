"use client";

// The archive table as a client component. For root and HSE it adds:
//  - a checkbox per row and "select all on this page"
//  - "select all N matching the current filters" (across every page)
//  - Export to Excel (selected rows, or everything matching the filters)
//  - permanent delete, in small batches with progress; deleting more
//    than the visible page needs a typed confirmation ("DELETE 212")
// Everyone else sees the plain read-only table.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../components/Icon";
import { downloadPermitWorkbook, archiveRowToExportPermit } from "../../../lib/exportPermits";

const DELETE_BATCH = 25;

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function ArchiveTable({
  rows,
  attachmentsByRef,
  canDelete,
  canExport,
  total,
  filters,
  sort,
  today,
}) {
  const router = useRouter();
  const selectable = canDelete || canExport;

  const [selected, setSelected] = useState(() => new Set());
  const [matchingMode, setMatchingMode] = useState(false); // selection = every permit matching the filters
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState("idle"); // idle | ids | deleting | exporting
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState({ kind: "", text: "" });
  const cancelRef = useRef(false);

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));
  const working = busy !== "idle";

  const requiredPhrase = `DELETE ${selected.size}`;
  const needsTyped = matchingMode || selected.size > pageIds.length;
  const typedOk = !needsTyped || typed.trim() === requiredPhrase;

  function base(prev) {
    // Leaving "all matching" mode: keep only what is visible on this page.
    return matchingMode ? new Set(pageIds) : new Set(prev);
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = base(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMatchingMode(false);
    setConfirming(false);
    setTyped("");
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = base(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
    setMatchingMode(false);
    setConfirming(false);
    setTyped("");
  }

  function clearSelection() {
    setSelected(new Set());
    setMatchingMode(false);
    setConfirming(false);
    setTyped("");
  }

  async function selectAllMatching() {
    setBusy("ids");
    setMessage({ kind: "", text: "" });
    try {
      const { ok, data } = await postJson("/api/admin/archive/ids", { filters });
      if (!ok) {
        setMessage({ kind: "error", text: data.error || "Could not select all matching permits." });
        return;
      }
      if (data.truncated) {
        setMessage({
          kind: "error",
          text: `More than ${data.ids.length} permits match. Narrow the filters (for example a date range) and try again.`,
        });
        return;
      }
      if (data.total !== total) {
        setMessage({
          kind: "error",
          text: "The archive changed while you were looking at it. Reload the page and try again.",
        });
        return;
      }
      setSelected(new Set(data.ids));
      setMatchingMode(true);
      setConfirming(false);
      setTyped("");
    } catch {
      setMessage({ kind: "error", text: "Network error. Try again." });
    } finally {
      setBusy("idle");
    }
  }

  async function runDelete() {
    const ids = [...selected];
    cancelRef.current = false;
    setBusy("deleting");
    setMessage({ kind: "", text: "" });
    setProgress({ done: 0, total: ids.length });

    let deleted = 0;
    let missing = 0;
    let kept = 0;
    const failed = [];
    let stopped = "";

    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
      if (cancelRef.current) {
        stopped = "Stopped before finishing.";
        break;
      }
      const batch = ids.slice(i, i + DELETE_BATCH);
      try {
        const { ok, data } = await postJson("/api/admin/archive/delete", { ids: batch });
        if (!ok) {
          stopped = data.error || "A batch failed, so deleting stopped.";
          break;
        }
        deleted += data.deleted || 0;
        missing += data.missing || 0;
        kept += data.kept || 0;
        failed.push(...(data.failed || []));
      } catch {
        stopped = "Network error, so deleting stopped.";
        break;
      }
      setProgress({ done: Math.min(i + DELETE_BATCH, ids.length), total: ids.length });
    }

    const parts = [`${deleted} deleted`];
    if (failed.length) {
      const shown = failed.slice(0, 5).join(", ");
      parts.push(`${failed.length} failed (${shown}${failed.length > 5 ? ", …" : ""})`);
    }
    if (missing) parts.push(`${missing} no longer there`);
    if (kept) parts.push(`${kept} kept (still in the log)`);
    if (stopped) parts.push(stopped);

    setMessage({ kind: stopped || failed.length ? "error" : "ok", text: parts.join(" · ") });
    clearSelection();
    setBusy("idle");
    router.refresh();
  }

  async function runExport(kind) {
    setBusy("exporting");
    setMessage({ kind: "", text: "" });
    try {
      // Everything matching the filters, or just the ticked rows.
      const useFilters = kind === "matching" || matchingMode;
      const body = useFilters ? { filters, sort } : { ids: [...selected] };
      const { ok, data } = await postJson("/api/admin/archive/export", body);
      if (!ok) {
        setMessage({ kind: "error", text: data.error || "Could not read the archive for export." });
        return;
      }
      const permits = (data.rows || []).map((r) => archiveRowToExportPermit(r, today));
      await downloadPermitWorkbook({
        permits,
        template: data.template,
        filename: `Permit_Archive_export_${today || "today"}.xlsx`,
      });
      setMessage({
        kind: data.truncated ? "error" : "ok",
        text: data.truncated
          ? `Exported the first ${permits.length} permits. Narrow the filters to export the rest.`
          : `Exported ${permits.length} permit${permits.length === 1 ? "" : "s"} to Excel.`,
      });
    } catch (err) {
      console.error("Archive export failed:", err);
      setMessage({ kind: "error", text: "Could not create the Excel file. Try again." });
    } finally {
      setBusy("idle");
    }
  }

  return (
    <>
      {canExport && (
        <div className="archive-toolbar">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => runExport("matching")}
            disabled={working || total === 0}
            title="Download every archived permit matching the filters above"
          >
            <Icon name="download" size={15} />
            {busy === "exporting" ? "Preparing…" : `Export all ${total} matching to Excel`}
          </button>
        </div>
      )}

      {selectable && selected.size > 0 && (
        <div className="archive-bulkbar" role="region" aria-label="Selected permits">
          <div className="archive-bulkbar__top">
            <span className="archive-bulkbar__count">
              {selected.size} selected{matchingMode ? " (all matching the filters)" : ""}
            </span>

            {!matchingMode && allOnPageSelected && total > pageIds.length && (
              <span className="archive-bulkbar__hint">
                All {pageIds.length} on this page are selected.{" "}
                <button
                  type="button"
                  className="archive-linkbtn"
                  onClick={selectAllMatching}
                  disabled={working}
                >
                  {busy === "ids" ? "Selecting…" : `Select all ${total} matching`}
                </button>
              </span>
            )}
            {matchingMode && (
              <span className="archive-bulkbar__hint">
                Includes permits on other pages.{" "}
                <button type="button" className="archive-linkbtn" onClick={clearSelection} disabled={working}>
                  Clear selection
                </button>
              </span>
            )}
          </div>

          {!confirming && (
            <div className="archive-bulkbar__actions">
              <button type="button" className="btn btn-ghost" onClick={clearSelection} disabled={working}>
                Clear
              </button>
              {canExport && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => runExport("selected")}
                  disabled={working}
                >
                  <Icon name="download" size={15} />
                  {busy === "exporting" ? "Preparing…" : "Export selected"}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setConfirming(true)}
                  disabled={working}
                >
                  <Icon name="trash" size={15} />
                  Delete selected
                </button>
              )}
            </div>
          )}

          {confirming && canDelete && (
            <div className="archive-bulkbar__confirm">
              <p className="archive-bulkbar__warn">
                This permanently deletes {selected.size} archived permit{selected.size === 1 ? "" : "s"} and
                any attached files. This can&rsquo;t be undone
                {canExport ? " — consider using Export selected first" : ""}.
              </p>
              {needsTyped && (
                <label className="archive-typed">
                  <span>
                    Type <strong className="mono">{requiredPhrase}</strong> to confirm
                  </span>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy === "deleting"}
                  />
                </label>
              )}
              {busy === "deleting" && (
                <div className="archive-progress" aria-live="polite">
                  <div className="archive-progress__track">
                    <div
                      className="archive-progress__fill"
                      style={{
                        width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span>
                    Deleting… {progress.done} / {progress.total}
                  </span>
                </div>
              )}
              <div className="archive-bulkbar__actions">
                {busy !== "deleting" ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setConfirming(false);
                      setTyped("");
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                  >
                    Stop after this batch
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={runDelete}
                  disabled={busy === "deleting" || !typedOk}
                >
                  {busy === "deleting" ? "Deleting…" : "Yes, delete permanently"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {message.text && (
        <p
          className={message.kind === "error" ? "error-text" : "archive-bulkbar__result"}
          style={{ marginTop: 0 }}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}

      <div className="table-scroll panel">
        <table className="permit-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                    }}
                    onChange={toggleAllOnPage}
                    disabled={working}
                    aria-label="Select all permits on this page"
                  />
                </th>
              )}
              <th>Permit No.</th>
              <th>Area</th>
              <th>Type</th>
              <th>Job</th>
              <th>Holder</th>
              <th>Valid to</th>
              <th>Last status</th>
              <th>Left the log</th>
              <th>Attachments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "is-selected" : undefined}>
                {selectable && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      disabled={working}
                      aria-label={`Select permit ${r.reference}`}
                    />
                  </td>
                )}
                <td className="mono">{r.reference}</td>
                <td>{r.area}</td>
                <td>{r.permit_type}</td>
                <td>{r.job_description}</td>
                <td>{r.holder}</td>
                <td className="mono">{r.valid_to}</td>
                <td>{r.excel_status}</td>
                <td className="mono">
                  {r.in_log
                    ? "Still in log"
                    : new Date(r.archived_at).toLocaleDateString("en-GB", { timeZone: "Asia/Muscat" })}
                </td>
                <td>
                  {(attachmentsByRef[r.reference] || []).map((a) => (
                    <div key={a.id}>
                      <a href={`/api/attachments/${a.id}/view`} target="_blank" rel="noreferrer">
                        {a.label}
                      </a>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
