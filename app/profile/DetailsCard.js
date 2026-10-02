"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../components/Icon";
import { formatWhen } from "../../lib/format";

// Tells the header to forget the remembered name and ask the server again.
function announceProfileChanged() {
  try {
    window.sessionStorage.removeItem("permit-log-me");
  } catch (err) {
    // storage unavailable - nothing to clear
  }
  window.dispatchEvent(new Event("permit:me-changed"));
}

export default function DetailsCard({
  staffId,
  name,
  role,
  linkedNames = [],
  hideLinkRow = false,
  idChangeAvailable,
  openRequest,
  recent,
}) {
  const router = useRouter();

  // ---- name (edit in place) ----
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [nameState, setNameState] = useState("idle"); // idle | saving | saved | error
  const [nameMessage, setNameMessage] = useState("");

  async function saveName(e) {
    e.preventDefault();
    setNameState("saving");
    setNameMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNameState("error");
        setNameMessage(data.error || "Could not save your name.");
        return;
      }
      setNameValue(data.displayName);
      setNameState("saved");
      setEditingName(false);
      announceProfileChanged();
      router.refresh();
    } catch {
      setNameState("error");
      setNameMessage("Network error. Try again.");
    }
  }

  function cancelName() {
    setNameValue(name);
    setNameState("idle");
    setNameMessage("");
    setEditingName(false);
  }

  // ---- staff id request ----
  const [idOpen, setIdOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [reason, setReason] = useState("");
  const [idState, setIdState] = useState("idle"); // idle | sending | error
  const [idMessage, setIdMessage] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  async function sendRequest(e) {
    e.preventDefault();
    setIdState("sending");
    setIdMessage("");
    try {
      const res = await fetch("/api/profile/staff-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStaffId: newId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdState("error");
        setIdMessage(data.error || "Could not send the request.");
        return;
      }
      setNewId("");
      setReason("");
      setIdOpen(false);
      setIdState("idle");
      router.refresh();
    } catch {
      setIdState("error");
      setIdMessage("Network error. Try again.");
    }
  }

  async function withdraw() {
    setIdState("sending");
    setIdMessage("");
    try {
      const res = await fetch("/api/profile/staff-id", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdState("error");
        setIdMessage(data.error || "Could not withdraw the request.");
        return;
      }
      setConfirmWithdraw(false);
      setIdState("idle");
      router.refresh();
    } catch {
      setIdState("error");
      setIdMessage("Network error. Try again.");
    }
  }

  const nameChanged = nameValue.trim() !== name.trim();

  return (
    <div className="panel pf-card">
      <h3 className="pf-card__title">Details</h3>

      <div className="pf-rows">
        {/* ---- name ---- */}
        <div className="pf-row">
          <span className="pf-row__label">Name</span>
          {editingName ? (
            <form onSubmit={saveName} className="pf-row__edit">
              <input
                type="text"
                value={nameValue}
                maxLength={40}
                autoComplete="name"
                autoFocus
                aria-label="Name"
                onChange={(e) => setNameValue(e.target.value)}
                className="passcode-input pf-input"
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!nameChanged || nameValue.trim().length < 2 || nameState === "saving"}
              >
                {nameState === "saving" ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelName}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span className="pf-row__value">{name || <span className="pf-muted">Not set</span>}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingName(true)}>
                Edit
              </button>
            </>
          )}
        </div>
        <div aria-live="polite">
          {nameState === "saved" && !editingName && (
            <p className="pf-ok">
              <Icon name="checkCircle" size={14} /> Name saved.
            </p>
          )}
          {nameState === "error" && <p className="error-text">{nameMessage}</p>}
        </div>

        {/* ---- staff id ---- */}
        <div className="pf-row">
          <span className="pf-row__label">Staff ID</span>
          <span className="pf-row__value mono">{staffId}</span>
          {idChangeAvailable && !openRequest && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={idOpen}
              onClick={() => setIdOpen((v) => !v)}
            >
              {idOpen ? "Close" : "Request change"}
            </button>
          )}
        </div>

        {!idChangeAvailable && (
          <p className="pf-muted pf-row__note">
            Changing the Staff ID is not available yet. Ask HSE to finish the system update.
          </p>
        )}

        {openRequest && (
          <div className="pf-callout pf-callout--wait">
            <Icon name="clock" size={16} />
            <div>
              <p>
                Waiting for approval: <span className="mono">{openRequest.oldStaffId}</span> →{" "}
                <strong className="mono">{openRequest.newStaffId}</strong>
              </p>
              <p className="pf-muted">
                Sent {formatWhen(openRequest.requestedAt)}. Keep signing in with{" "}
                <span className="mono">{openRequest.oldStaffId}</span> until it is approved.
                {openRequest.reason && <> Reason: {openRequest.reason}</>}
              </p>
              {confirmWithdraw ? (
                <div className="pf-inline-actions">
                  <span className="pf-muted">Withdraw this request?</span>
                  <button type="button" className="btn btn-primary btn-sm" disabled={idState === "sending"} onClick={withdraw}>
                    Yes, withdraw
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmWithdraw(false)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmWithdraw(true)}>
                  Withdraw request
                </button>
              )}
            </div>
          </div>
        )}

        {!openRequest && recent && recent.status === "approved" && (
          <div className="pf-callout pf-callout--ok">
            <Icon name="checkCircle" size={16} />
            <p>
              Approved {formatWhen(recent.decidedAt)}. Your Staff ID is now{" "}
              <strong className="mono">{recent.newStaffId}</strong>. Use it the next time you sign in.
            </p>
          </div>
        )}
        {!openRequest && recent && recent.status === "rejected" && (
          <div className="pf-callout pf-callout--bad">
            <Icon name="xCircle" size={16} />
            <p>
              Your request for <span className="mono">{recent.newStaffId}</span> was not approved (
              {formatWhen(recent.decidedAt)}).{recent.note && <> {recent.note}</>}
            </p>
          </div>
        )}

        {idOpen && !openRequest && idChangeAvailable && (
          <form onSubmit={sendRequest} className="pf-request">
            <p className="pf-muted" style={{ margin: 0 }}>
              Typed it wrong at sign-up? Ask for the correct one. An admin approves it, and your permits, uploads and
              history move to the new ID. Until then you sign in with <span className="mono">{staffId}</span>.
            </p>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="New Staff ID"
              aria-label="New Staff ID"
              autoComplete="off"
              maxLength={12}
              className="passcode-input pf-input"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional), e.g. typed it wrong"
              aria-label="Reason"
              maxLength={200}
              className="passcode-input pf-input"
            />
            <div className="pf-inline-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={newId.trim().length < 3 || idState === "sending"}
              >
                {idState === "sending" ? "Sending…" : "Send for approval"}
              </button>
            </div>
          </form>
        )}
        {idState === "error" && <p className="error-text">{idMessage}</p>}

        {/* ---- role ---- */}
        <div className="pf-row">
          <span className="pf-row__label">Role</span>
          <span className="pf-row__value">{role}</span>
        </div>

        {/* ---- excel names (not shown to a Manager with no linked name) ---- */}
        {!hideLinkRow && (
        <div className="pf-row pf-row--top">
          <span className="pf-row__label">Name in the permit log</span>
          <span className="pf-row__value">
            {linkedNames.length > 0 ? (
              <span className="pf-tags">
                {linkedNames.map((n) => (
                  <span key={n} className="pf-tag mono">
                    {n}
                  </span>
                ))}
              </span>
            ) : (
              <span className="pf-muted">Not linked yet. Ask HSE to link your name.</span>
            )}
          </span>
        </div>
        )}
      </div>
    </div>
  );
}
