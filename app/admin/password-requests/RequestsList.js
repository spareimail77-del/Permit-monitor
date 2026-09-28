"use client";

import { useState } from "react";

export default function RequestsList({ initial }) {
  const [rows, setRows] = useState(initial);
  const [results, setResults] = useState({}); // id -> { staffId, tempPassword }
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function act(id, action) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/password-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (action === "reset") {
        setResults((r) => ({ ...r, [id]: data }));
      } else {
        setRows((list) => list.filter((x) => x.id !== id));
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p style={{ color: "var(--color-ink-muted)" }}>No open requests.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {error && <p className="error-text">{error}</p>}
      {rows.map((r) => {
        const done = results[r.id];
        return (
          <div key={r.id} className="panel" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong className="mono">{r.staffId}</strong>
                {r.name && <span style={{ marginLeft: 8 }}>{r.name}</span>}
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
                  Requested {new Date(r.requestedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              {!done && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "reset")}
                  >
                    {busy === r.id ? "Working…" : "Set temporary password"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "dismiss")}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            {done && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" }}>
                  Temporary password for {done.staffId} (shown once — note it down now):
                </div>
                <div className="mono" style={{ fontSize: "var(--font-size-lg)", margin: "6px 0", userSelect: "all" }}>
                  {done.tempPassword}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
