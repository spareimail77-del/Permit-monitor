"use client";

// The archive table itself, as a client component: renders the rows
// the server already fetched/filtered/paginated, and — for root and
// HSE only — adds a checkbox per row, "select all on this page", and
// a delete bar. Everyone else sees the exact same read-only table as
// before this step (no checkbox column at all).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function ArchiveTable({ rows, attachmentsByRef, canDelete }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState("idle"); // idle | deleting | error
  const [message, setMessage] = useState("");

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirming(false);
    setState("idle");
    setMessage("");
  }

  async function handleDelete() {
    setState("deleting");
    setMessage("");
    try {
      const res = await fetch("/api/admin/archive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not delete the selected permits.");
        return;
      }
      const parts = [`${data.deleted} deleted`];
      if (data.failed?.length) parts.push(`${data.failed.length} failed (${data.failed.join(", ")})`);
      if (data.missing) parts.push(`${data.missing} no longer there`);
      setMessage(parts.join(" · "));
      setSelected(new Set());
      setConfirming(false);
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <>
      {canDelete && selected.size > 0 && (
        <div className="archive-bulkbar">
          <span className="archive-bulkbar__count">{selected.size} selected</span>

          {!confirming && (
            <>
              <button type="button" className="btn btn-ghost" onClick={clearSelection}>
                Clear
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
                Delete selected
              </button>
            </>
          )}

          {confirming && (
            <>
              <span className="archive-bulkbar__warn">
                This permanently deletes {selected.size} archived permit{selected.size === 1 ? "" : "s"} and
                any attached files. This can&rsquo;t be undone.
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirming(false)}
                disabled={state === "deleting"}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={state === "deleting"}>
                {state === "deleting" ? "Deleting…" : "Yes, delete permanently"}
              </button>
            </>
          )}
        </div>
      )}

      {message && (
        <p className={state === "error" ? "error-text" : "archive-bulkbar__result"} style={{ marginTop: 0 }}>
          {message}
        </p>
      )}

      <div className="table-scroll panel">
        <table className="permit-table">
          <thead>
            <tr>
              {canDelete && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                    }}
                    onChange={toggleAllOnPage}
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
              <th>Archived</th>
              <th>Attachments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canDelete && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
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
                <td className="mono">{new Date(r.archived_at).toLocaleDateString("en-GB")}</td>
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
