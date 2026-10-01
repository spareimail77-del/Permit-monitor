"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../components/Icon";
import { formatWhen } from "../../../lib/format";

const STATUS_STYLE = {
  approved: { background: "var(--color-open-tint)", color: "var(--color-open)" },
  rejected: { background: "var(--color-expired-tint)", color: "var(--color-expired)" },
  cancelled: { background: "var(--color-closed-tint)", color: "var(--color-closed)" },
};

export default function IdChangesList({ initialOpen, decided, canDecideOwn }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [doneIds, setDoneIds] = useState({}); // id -> "approved" | "rejected"

  async function decide(r, action) {
    let note = "";
    if (action === "reject") {
      const answer = window.prompt(
        `Reject ${r.oldStaffId} → ${r.newStaffId}?\nOptional reason shown to the person:`,
        ""
      );
      if (answer === null) return; // cancelled
      note = answer;
    } else if (
      !window.confirm(
        `Change ${r.name || r.oldStaffId} from ${r.oldStaffId} to ${r.newStaffId}?\n\nThey will sign in with the new ID from now on.`
      )
    ) {
      return;
    }

    setBusy(r.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/id-changes/${r.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setDoneIds((d) => ({ ...d, [r.id]: action === "approve" ? "approved" : "rejected" }));
      router.refresh(); // moves it into the history list below
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={styles.h3}>Waiting for a decision ({open.filter((r) => !doneIds[r.id]).length})</h3>
        {open.length === 0 ? (
          <div className="panel" style={{ padding: "16px 20px" }}>
            <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
              No open requests.
            </p>
          </div>
        ) : (
          open.map((r) => {
            const done = doneIds[r.id];
            const blocked = r.isMe && !canDecideOwn;
            return (
              <div key={r.id} className="panel" style={{ padding: "14px 18px" }}>
                <div style={styles.cardTop}>
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <strong>{r.name || r.oldStaffId}</strong>
                      {r.isMe && <span style={styles.you}>(you)</span>}
                    </div>
                    <div style={styles.change}>
                      <span className="mono">{r.oldStaffId}</span>
                      <Icon name="arrowLeft" size={14} style={{ transform: "rotate(180deg)" }} />
                      <strong className="mono">{r.newStaffId}</strong>
                    </div>
                    <div style={styles.meta}>
                      Requested {formatWhen(r.requestedAt)}
                      {r.reason && <> · “{r.reason}”</>}
                    </div>
                  </div>
                  {done ? (
                    <span className="status-badge" style={STATUS_STYLE[done]}>
                      {done === "approved" ? "Approved" : "Rejected"}
                    </span>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy === r.id || blocked}
                        title={blocked ? "Another admin has to decide your own request" : undefined}
                        onClick={() => decide(r, "approve")}
                      >
                        {busy === r.id ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy === r.id || blocked}
                        onClick={() => decide(r, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {blocked && !done && (
                  <p style={{ ...styles.meta, marginTop: 8 }}>Another admin has to decide your own request.</p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div>
        <h3 style={styles.h3}>Recent decisions</h3>
        {decided.length === 0 ? (
          <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
            Nothing decided yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="permit-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Decided (Oman time)</th>
                  <th>Person</th>
                  <th>Change</th>
                  <th>Result</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatWhen(r.decidedAt || r.requestedAt)}</td>
                    <td>{r.name || "–"}</td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      {r.oldStaffId} → {r.newStaffId}
                    </td>
                    <td>
                      <span className="status-badge" style={STATUS_STYLE[r.status]}>
                        {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Withdrawn"}
                      </span>
                      {r.note && <div style={styles.meta}>{r.note}</div>}
                    </td>
                    <td>{r.status === "cancelled" ? "The person" : r.decidedBy || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  h3: { margin: "0 0 10px", fontSize: "var(--font-size-lg)", color: "var(--color-ink)" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  change: { display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: "var(--font-size-base)" },
  meta: { marginTop: 4, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" },
  you: { marginLeft: 8, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" },
};
