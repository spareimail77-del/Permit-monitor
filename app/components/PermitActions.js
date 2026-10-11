"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Close, cancel, reopen and delete one permit (Root and HSE; the server checks
// again). status: the stored status OPEN / CLOSED / CANCELED.
export default function PermitActions({ permitId, reference, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(""); // "" | "cancel" | "delete"
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });

  async function call(method, body, after) {
    if (busy) return;
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      const res = await fetch(`/api/permits/${permitId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "That did not work.", error: true });
        setBusy(false);
        return;
      }
      after(data);
    } catch {
      setMessage({ text: "Network error. Try again.", error: true });
      setBusy(false);
    }
  }

  function done() {
    setBusy(false);
    setPanel("");
    setReason("");
    router.refresh();
  }

  return (
    <div className="panel pform-card" style={{ marginBottom: 16 }}>
      <h3 className="pform-title">Actions</h3>
      <div className="row-actions">
        {status === "OPEN" && (
          <>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Close permit ${reference}? Today's date is saved as the closed date.`)) {
                  call("PATCH", { action: "close" }, done);
                }
              }}
            >
              Close permit
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setPanel(panel === "cancel" ? "" : "cancel")}>
              Cancel permit
            </button>
          </>
        )}
        {status !== "OPEN" && (
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Reopen permit ${reference}? Its closed date or cancel reason is cleared.`)) {
                call("PATCH", { action: "reopen" }, done);
              }
            }}
          >
            Reopen
          </button>
        )}
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => setPanel(panel === "delete" ? "" : "delete")}>
          Delete permit
        </button>
      </div>

      {panel === "cancel" && (
        <div style={{ marginTop: 14 }} className="pform">
          <div className="pform-field">
            <label htmlFor="pa-reason">Reason for cancelling</label>
            <input id="pa-reason" className="pform-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} disabled={busy} />
          </div>
          <div className="pform-actions">
            <button className="btn btn-primary btn-sm" disabled={busy || !reason.trim()} onClick={() => call("PATCH", { action: "cancel", reason }, done)}>
              {busy ? "Saving…" : "Cancel this permit"}
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setPanel("")}>
              Never mind
            </button>
          </div>
        </div>
      )}

      {panel === "delete" && (
        <div style={{ marginTop: 14 }} className="notice notice--danger">
          <p style={{ margin: "0 0 10px" }}>
            This deletes permit <strong className="mono">{reference}</strong> <strong>and all of its documents</strong>, for
            good. It cannot be undone. If you only want to stop using the permit, cancel it instead.
          </p>
          <div className="pform">
            <div className="pform-field">
              <label htmlFor="pa-typed">Type the permit number to confirm</label>
              <input id="pa-typed" className="pform-input mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={busy} />
            </div>
            <div className="pform-actions">
              <button
                className="btn btn-danger btn-sm"
                disabled={busy || typed.trim().toUpperCase() !== String(reference).trim().toUpperCase()}
                onClick={() =>
                  call("DELETE", { confirm: typed }, (data) => {
                    const note = data.filesNotRemoved ? `&note=${data.filesNotRemoved}` : "";
                    window.location.href = `/permits?deleted=${encodeURIComponent(reference)}${note}`;
                  })
                }
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => setPanel("")}>
                Never mind
              </button>
            </div>
          </div>
        </div>
      )}

      {message.text && <p className={message.error ? "error-text" : "pform-rec"} style={{ marginTop: 10 }}>{message.text}</p>}
    </div>
  );
}
