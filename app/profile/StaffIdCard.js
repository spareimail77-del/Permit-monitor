"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RESULT = { approved: "approved", rejected: "rejected", cancelled: "cancelled" };

export default function StaffIdCard({ currentId, latest }) {
  const router = useRouter();
  const [newId, setNewId] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState({ busy: false, text: "", error: false });
  const open = latest?.status === "open";

  async function send(body, doneText) {
    if (state.busy) return;
    setState({ busy: true, text: "", error: false });
    try {
      const res = await fetch("/api/profile/staff-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ busy: false, text: data.error || "Could not save.", error: true });
      setNewId("");
      setReason("");
      setState({ busy: false, text: doneText, error: false });
      router.refresh();
    } catch {
      setState({ busy: false, text: "Network error. Try again.", error: true });
    }
  }

  return (
    <div className="panel pform-card">
      <h2 className="pform-title">Staff ID</h2>
      {open ? (
        <>
          <p className="mb-3">
            Your request to change <span className="mono">{currentId}</span> to <strong className="mono">{latest.newId}</strong> is
            waiting for Root. Until it is approved, keep signing in with <span className="mono">{currentId}</span>.
          </p>
          <button type="button" className="btn btn-sm" disabled={state.busy} onClick={() => send({ action: "cancel" }, "Request cancelled.")}>
            Cancel the request
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send({ action: "request", newStaffId: newId, reason }, "Request sent. Root will decide.");
          }}
        >
          {latest && (
            <p className="pform-hint mb-3">
              Your last request ({latest.oldId} → {latest.newId}) was {RESULT[latest.status] || latest.status}
              {latest.note ? `: ${latest.note}` : "."}
            </p>
          )}
          <div className="pform-grid">
            <div className="pform-field">
              <label htmlFor="sid-new">New Staff ID</label>
              <input id="sid-new" className="pform-input" value={newId} onChange={(e) => setNewId(e.target.value)} maxLength={12} autoCapitalize="none" />
              <p className="pform-hint">3 to 12 letters or digits. Root must approve it.</p>
            </div>
            <div className="pform-field">
              <label htmlFor="sid-why">Reason (optional)</label>
              <input id="sid-why" className="pform-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="pform-actions mt-3">
            <button type="submit" className="btn btn-primary btn-sm" disabled={state.busy || newId.trim().length < 3}>
              {state.busy ? "Sending…" : "Ask to change my Staff ID"}
            </button>
          </div>
        </form>
      )}
      {state.text && <p className={state.error ? "error-text mt-3" : "pform-rec mt-3"}>{state.text}</p>}
    </div>
  );
}
