"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TrashList({ rows, canPurge }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null); // permit id, or "all"
  const [message, setMessage] = useState({ text: "", error: false });

  async function call(url, body, busyKey, okText) {
    if (busyId) return;
    setBusyId(busyKey);
    setMessage({ text: "", error: false });
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "That did not work.", error: true });
      } else {
        const warn = data.filesNotRemoved ? ` ${data.filesNotRemoved} file(s) could not be erased from storage (see the Vercel logs).` : "";
        setMessage({ text: okText + warn, error: Boolean(warn) });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Network error. Try again.", error: true });
    } finally {
      setBusyId(null);
    }
  }

  const restore = (r) => call("/api/trash/restore", { id: r.id }, r.id, `Permit ${r.reference} restored.`);

  const purge = (r) => {
    const n = r.files ? ` and its ${r.files} document${r.files === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete permit ${r.reference}${n} for good? This cannot be undone.`)) return;
    call("/api/trash/purge", { id: r.id }, r.id, `Permit ${r.reference} deleted for good.`);
  };

  const emptyTrash = () => {
    const typed = window.prompt(`This deletes all ${rows.length} permit(s) in the trash, with their documents, for good.\nType EMPTY to confirm.`);
    if (typed === null || typed.trim().toUpperCase() !== "EMPTY") return;
    call("/api/trash/purge", { all: true }, "all", "The trash was emptied.");
  };

  return (
    <>
      {message.text && <div className={message.error ? "notice notice--danger" : "notice notice--ok"}>{message.text}</div>}
      {canPurge && rows.length > 0 && (
        <p>
          <button className="btn btn-danger btn-sm" disabled={Boolean(busyId)} onClick={emptyTrash}>
            {busyId === "all" ? "Emptying…" : "Empty the trash"}
          </button>
        </p>
      )}
      <div className="panel table-wrap">
        {rows.length === 0 ? (
          <p className="empty">The trash is empty.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Permit no.</th>
                <th>Area</th>
                <th>Location</th>
                <th>Type</th>
                <th>Docs</th>
                <th>Deleted by</th>
                <th>Deleted (Oman time)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/permits/${r.id}`} className="mono">
                      {r.reference}
                    </Link>
                    <div>
                      <span className={`badge badge--${r.status}`}>{r.status}</span>
                    </div>
                  </td>
                  <td>{r.area}</td>
                  <td>{r.location}</td>
                  <td>{r.type}</td>
                  <td>{r.files}</td>
                  <td className="mono">{r.deletedBy || "—"}</td>
                  <td className="pform-hint">{r.deletedAt}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-primary btn-sm" disabled={Boolean(busyId)} onClick={() => restore(r)}>
                        Restore
                      </button>
                      {canPurge && (
                        <button className="btn btn-danger btn-sm" disabled={Boolean(busyId)} onClick={() => purge(r)}>
                          Delete for good
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
