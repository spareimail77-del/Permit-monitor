"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RESULT = { approved: "Approved", rejected: "Rejected", cancelled: "Cancelled by the person" };

export default function IdChangesList({ rows }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function act(row, action) {
    if (busyId) return;
    const text =
      action === "approve"
        ? `Change Staff ID ${row.oldId} to ${row.newId}?`
        : `Reject the change from ${row.oldId} to ${row.newId}?`;
    if (!window.confirm(text)) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/id-changes/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not save.");
      else router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const open = rows.filter((r) => r.status === "open");
  const old = rows.filter((r) => r.status !== "open");

  return (
    <>
      {error && <div className="notice notice--danger">{error}</div>}

      <h2 className="section-title">Waiting</h2>
      <div className="panel table-wrap">
        {open.length === 0 ? (
          <p className="empty">Nothing waiting.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Change</th>
                <th>Reason</th>
                <th>Asked (Oman time)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {open.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    {r.oldId} → <strong>{r.newId}</strong>
                  </td>
                  <td>{r.reason || "—"}</td>
                  <td className="pform-hint">{r.created}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-primary btn-sm" disabled={busyId === r.id} onClick={() => act(r, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => act(r, "reject")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {old.length > 0 && (
        <>
          <h2 className="section-title">Decided (latest 100 requests)</h2>
          <div className="panel table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Change</th>
                  <th>Result</th>
                  <th>By</th>
                  <th>When (Oman time)</th>
                </tr>
              </thead>
              <tbody>
                {old.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">
                      {r.oldId} → {r.newId}
                    </td>
                    <td>{RESULT[r.status] || r.status}</td>
                    <td className="mono">{r.decidedBy || "—"}</td>
                    <td className="pform-hint">{r.decided || r.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
