"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";
import CloseCheckDialog from "./CloseCheckDialog";

// Close, cancel, reopen and move one permit to the trash (Root and HSE; the server
// checks again). status: the stored status OPEN / CLOSED / CANCELED.
// Routine actions are on the left; the destructive one is kept apart on the right.
// missing: empty holder / issuer / area authority fields; missingCerts: certificates without an
// attached copy. Both [] = nothing to remind. Checked again when closing.
// paperMissing: the closed permit's paper copy is recorded as missing (it still counts as Closed).
// options: { holder: [...], issuer: [...] } for filling the empty details in the popup (or null).
export default function PermitActions({ permitId, reference, status, paperMissing = false, missing = [], missingCerts = [], options = null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(""); // "" | close | closecheck | reopen | trash
  const [panel, setPanel] = useState(""); // "" | "cancel"
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  async function call(method, body, after) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/permits/${permitId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "That did not work.");
        setBusy(false);
        setDialog("");
        return;
      }
      after();
    } catch {
      setMessage("Network error. Try again.");
      setBusy(false);
      setDialog("");
    }
  }

  function done() {
    setBusy(false);
    setDialog("");
    setPanel("");
    setReason("");
    router.refresh();
  }

  const texts = {
    close: { title: `Close permit ${reference}?`, body: "Today's date (Oman time) is saved as the closed date.", go: "Close permit", danger: false },
    reopen: { title: `Reopen permit ${reference}?`, body: "Its closed date or cancel reason is cleared.", go: "Reopen permit", danger: false },
    closemissing: { title: `Close permit ${reference} as MISSING?`, body: "The paper copy is recorded as missing. The permit counts as Closed everywhere on the site, and shows MISSING in the Excel export.", go: "Close as missing", danger: true },
    markmissing: { title: `Mark the paper copy of ${reference} as missing?`, body: "It stays Closed on the site. The Excel export shows MISSING instead of CLOSED.", go: "Mark as missing", danger: true },
    markfound: { title: `Paper copy of ${reference} found?`, body: "The Missing tag is removed. The Excel export shows CLOSED again.", go: "Paper copy found", danger: false },
    trash: { title: `Move permit ${reference} to the trash?`, body: "Nothing is erased. Root or HSE can restore it from the Trash page.", go: "Move to trash", danger: true },
  };
  const t = texts[dialog];

  function confirm() {
    if (dialog === "close") call("PATCH", { action: "close" }, done);
    else if (dialog === "closemissing") call("PATCH", { action: "close", missing: true }, done);
    else if (dialog === "markmissing") call("PATCH", { action: "mark_missing" }, done);
    else if (dialog === "markfound") call("PATCH", { action: "mark_found" }, done);
    else if (dialog === "reopen") call("PATCH", { action: "reopen" }, done);
    else if (dialog === "trash") call("DELETE", {}, () => (window.location.href = `/permits?trashed=${encodeURIComponent(reference)}`));
  }

  return (
    <section className="pd-actions pd-noprint" aria-label="Permit actions">
      <div className="pd-actions__row">
        <div className="row-actions">
          {status === "OPEN" ? (
            <>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog(missing.length > 0 || missingCerts.length > 0 ? "closecheck" : "close")}>
                Close permit
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog("closemissing")}>
                Close as missing
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => setPanel(panel === "cancel" ? "" : "cancel")} aria-expanded={panel === "cancel"}>
                Cancel permit
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog("reopen")}>
                Reopen permit
              </button>
              {status === "CLOSED" && (
                <button className="btn btn-sm" disabled={busy} onClick={() => setDialog(paperMissing ? "markfound" : "markmissing")}>
                  {paperMissing ? "Paper copy found" : "Mark paper copy missing"}
                </button>
              )}
            </>
          )}
        </div>
        <button className="btn btn-sm btn--danger-outline" disabled={busy} onClick={() => setDialog("trash")}>
          Move to trash
        </button>
      </div>

      {panel === "cancel" && (
        <div className="pd-cancel">
          <label htmlFor="pa-reason" className="pform-label">Reason for cancelling</label>
          <input id="pa-reason" className="pform-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} disabled={busy} autoFocus />
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

      {message && <p className="error-text mt-3" role="alert">{message}</p>}

      <ConfirmDialog
        open={Boolean(t)}
        title={t?.title}
        body={t?.body}
        confirmLabel={t?.go}
        danger={t?.danger}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setDialog("")}
      />

      {dialog === "closecheck" && (
        <CloseCheckDialog
          items={[{ id: permitId, reference, missing, certs: missingCerts }]}
          total={1}
          editHref={`/permits/edit/${permitId}`}
          fix={{ options }}
          onClosed={done}
          busy={busy}
          onCancel={() => setDialog("")}
          onConfirm={() => call("PATCH", { action: "close" }, done)}
        />
      )}
    </section>
  );
}
