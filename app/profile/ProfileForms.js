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

export default function ProfileForms({ staffId, name, role, idChangeAvailable, openRequest, recent }) {
  const router = useRouter();

  // ---- name ----
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
      announceProfileChanged();
      router.refresh();
    } catch {
      setNameState("error");
      setNameMessage("Network error. Try again.");
    }
  }

  // ---- staff id ----
  const [newId, setNewId] = useState("");
  const [reason, setReason] = useState("");
  const [idState, setIdState] = useState("idle"); // idle | sending | error
  const [idMessage, setIdMessage] = useState("");

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
      setIdState("idle");
      router.refresh();
    } catch {
      setIdState("error");
      setIdMessage("Network error. Try again.");
    }
  }

  async function cancelRequest() {
    if (!window.confirm("Withdraw this request?")) return;
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
      setIdState("idle");
      router.refresh();
    } catch {
      setIdState("error");
      setIdMessage("Network error. Try again.");
    }
  }

  const nameChanged = nameValue.trim() !== name.trim();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ---- who you are ---- */}
      <div className="panel" style={styles.card}>
        <div style={styles.facts}>
          <div>
            <p style={styles.label}>Staff ID</p>
            <p className="mono" style={styles.value}>{staffId}</p>
          </div>
          <div>
            <p style={styles.label}>Role</p>
            <p style={styles.value}>{role}</p>
          </div>
        </div>

        <form onSubmit={saveName} style={{ marginTop: 18 }}>
          <label htmlFor="profile-name" style={styles.label}>Name</label>
          <div style={styles.row}>
            <input
              id="profile-name"
              type="text"
              value={nameValue}
              maxLength={40}
              autoComplete="name"
              onChange={(e) => {
                setNameValue(e.target.value);
                if (nameState !== "idle") setNameState("idle");
              }}
              className="passcode-input"
              style={styles.input}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!nameChanged || nameValue.trim().length < 2 || nameState === "saving"}
            >
              {nameState === "saving" ? "Saving…" : "Save name"}
            </button>
          </div>
          {nameState === "saved" && (
            <p style={styles.okLine}>
              <Icon name="checkCircle" size={14} /> Name saved.
            </p>
          )}
          {nameState === "error" && <p className="error-text" style={{ marginTop: 8 }}>{nameMessage}</p>}
        </form>
      </div>

      {/* ---- staff id ---- */}
      <div className="panel" style={styles.card}>
        <h3 style={styles.h3}>Change Staff ID</h3>

        {!idChangeAvailable ? (
          <p style={styles.muted}>
            This is not available yet. Ask HSE to finish the system update, then try again.
          </p>
        ) : openRequest ? (
          <>
            <div style={styles.waiting}>
              <Icon name="clock" size={16} />
              <span>
                Waiting for approval:{" "}
                <span className="mono">{openRequest.oldStaffId}</span> →{" "}
                <strong className="mono">{openRequest.newStaffId}</strong>
              </span>
            </div>
            <p style={styles.muted}>
              Sent {formatWhen(openRequest.requestedAt)}. Keep signing in with{" "}
              <span className="mono">{openRequest.oldStaffId}</span> until it is approved.
              {openRequest.reason && <> Reason: {openRequest.reason}</>}
            </p>
            <button type="button" className="btn btn-ghost" disabled={idState === "sending"} onClick={cancelRequest}>
              Withdraw request
            </button>
          </>
        ) : (
          <>
            {recent && recent.status === "approved" && (
              <div style={styles.approved}>
                <Icon name="checkCircle" size={16} />
                <span>
                  Approved {formatWhen(recent.decidedAt)}. Your Staff ID is now{" "}
                  <strong className="mono">{recent.newStaffId}</strong>. Use it the next time you sign in.
                </span>
              </div>
            )}
            {recent && recent.status === "rejected" && (
              <div style={styles.rejected}>
                <Icon name="xCircle" size={16} />
                <span>
                  Your request for <span className="mono">{recent.newStaffId}</span> was not approved
                  ({formatWhen(recent.decidedAt)}).{recent.note && <> {recent.note}</>}
                </span>
              </div>
            )}

            <p style={styles.muted}>
              Entered it wrong at sign-up? Ask for the correct one. An admin has to approve it, so your
              permits, uploads and history move to the new ID. Until then you keep signing in with{" "}
              <span className="mono">{staffId}</span>.
            </p>
            <form onSubmit={sendRequest} style={{ display: "grid", gap: 10 }}>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="New Staff ID"
                aria-label="New Staff ID"
                autoComplete="off"
                maxLength={12}
                className="passcode-input"
                style={{ ...styles.input, textAlign: "left" }}
              />
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional), e.g. typed it wrong"
                aria-label="Reason"
                maxLength={200}
                className="passcode-input"
                style={{ ...styles.input, textAlign: "left", letterSpacing: "normal" }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={newId.trim().length < 3 || idState === "sending"}
                style={{ justifyContent: "center" }}
              >
                {idState === "sending" ? "Sending…" : "Send for approval"}
              </button>
            </form>
          </>
        )}

        {idState === "error" && <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>{idMessage}</p>}
      </div>
    </div>
  );
}

const styles = {
  card: { padding: "20px 24px" },
  facts: { display: "flex", gap: 36, flexWrap: "wrap" },
  label: {
    display: "block",
    margin: "0 0 4px",
    fontSize: "var(--font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-muted)",
  },
  value: { margin: 0, fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-ink)" },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  input: { margin: 0, flex: "1 1 200px", width: "auto", textAlign: "left", letterSpacing: "normal" },
  h3: { margin: "0 0 8px", fontSize: "var(--font-size-lg)", color: "var(--color-ink)" },
  muted: { margin: "0 0 14px", fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" },
  okLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    margin: "8px 0 0",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-open)",
  },
  waiting: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    marginBottom: 10,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-expiring-tint)",
    border: "1px solid var(--color-expiring)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-ink)",
  },
  approved: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 14px",
    marginBottom: 12,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-open-tint)",
    border: "1px solid var(--color-open)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-ink)",
  },
  rejected: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 14px",
    marginBottom: 12,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-expired-tint)",
    border: "1px solid var(--color-expired)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-ink)",
  },
};
