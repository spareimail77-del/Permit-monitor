"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TempPasswordNotice from "../TempPasswordNotice";

const DONE_TEXT = { done: "Password set", dismissed: "Dismissed" };

export default function RequestsList({ rows }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [temp, setTemp] = useState(null);

  async function act(row, action) {
    if (busyId) return;
    if (action === "reset" && !window.confirm(`Set a new temporary password for ${row.staffId}?`)) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/password-requests/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not save.");
      else {
        if (data.tempPassword) setTemp({ staffId: data.staffId, password: data.tempPassword });
        router.refresh();
      }
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
      {temp && <TempPasswordNotice staffId={temp.staffId} password={temp.password} onClose={() => setTemp(null)} />}
      {error && <div className="notice notice--danger">{error}</div>}

      <h2 className="section-title">Waiting</h2>
      <div className="panel table-wrap">
        {open.length === 0 ? (
          <p className="empty">Nothing waiting.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Staff ID / name</th>
                <th>Asked (Oman time)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {open.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong className="mono">{r.staffId}</strong>
                    <div className="pform-hint">{r.name || "—"}</div>
                  </td>
                  <td className="pform-hint">{r.created}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-primary btn-sm" disabled={busyId === r.id} onClick={() => act(r, "reset")}>
                        Set temporary password
                      </button>
                      <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => act(r, "dismiss")}>
                        Dismiss
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
          <h2 className="section-title">Handled (latest 100 requests)</h2>
          <div className="panel table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Result</th>
                  <th>By</th>
                  <th>When (Oman time)</th>
                </tr>
              </thead>
              <tbody>
                {old.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.staffId}</td>
                    <td>{DONE_TEXT[r.status] || r.status}</td>
                    <td className="mono">{r.resolvedBy || "—"}</td>
                    <td className="pform-hint">{r.resolved || r.created}</td>
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
