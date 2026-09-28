"use client";

import { useState, useMemo } from "react";
import { ROLE_LABELS, ALL_ROLES } from "../../../lib/permissions";
import Icon from "../../components/Icon";

const STATUS_STYLE = {
  pending: { background: "var(--color-brand-tint)", color: "var(--color-brand-2)" },
  active: { background: "var(--color-rule)", color: "var(--color-ink)" },
  disabled: { background: "var(--color-rule)", color: "var(--color-ink-faint)" },
};

const ONLINE_MINUTES = 5;

function agoText(min) {
  if (min === null || min === undefined) return "never seen";
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.floor(min / 60)} h ago`;
  return `${Math.floor(min / 1440)} d ago`;
}

export default function UsersList({ initial, meId, canManage, canReset }) {
  const [rows, setRows] = useState(initial);
  const [temp, setTemp] = useState({}); // id -> { staffId, tempPassword }
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function act(row, action, extra = {}) {
    setBusy(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (data.removed) {
        setRows((list) => list.filter((x) => x.id !== row.id));
      } else if (action === "resetPassword") {
        setTemp((t) => ({ ...t, [row.id]: data }));
      } else {
        setRows((list) =>
          list.map((x) =>
            x.id === row.id
              ? { ...x, status: data.status ?? x.status, role: data.role ?? x.role }
              : x
          )
        );
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function confirmThen(message, fn) {
    if (window.confirm(message)) fn();
  }

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter(
        (r) => !q || r.staffId.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
      ),
    [rows, q]
  );
  const pending = visible.filter((r) => r.status === "pending");
  const others = visible.filter((r) => r.status !== "pending");

  function card(r) {
    const isMe = r.id === meId;
    const t = temp[r.id];
    const disabled = busy === r.id;
    return (
      <div key={r.id} className="panel" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong className="mono">{r.staffId}</strong>
            {r.name && <span style={{ marginLeft: 8 }}>{r.name}</span>}
            {isMe && <span style={{ marginLeft: 8, fontSize: "var(--font-size-xs)" }}>(you)</span>}
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="status-badge" style={STATUS_STYLE[r.status]}>
                {r.status}
              </span>
              {canManage && r.status !== "pending" && !isMe ? (
                <select
                  value={r.role}
                  disabled={disabled}
                  aria-label={`Role for ${r.staffId}`}
                  onChange={(e) => {
                    const role = e.target.value;
                    confirmThen(
                      `Change ${r.staffId} to ${ROLE_LABELS[role]}?`,
                      () => act(r, "setRole", { role })
                    );
                  }}
                  style={{
                    padding: "5px 8px",
                    border: "1px solid var(--color-rule-strong)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface)",
                    color: "var(--color-ink)",
                    fontSize: "var(--font-size-xs)",
                  }}
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
                  {ROLE_LABELS[r.role] || r.role}
                </span>
              )}
              {canManage && r.status !== "pending" && (
                r.seenMin !== null && r.seenMin < ONLINE_MINUTES ? (
                  <span
                    title="Active in the last 5 minutes"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "var(--font-size-xs)",
                      color: "#1a7f45",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#1a7f45",
                        color: "#fff",
                      }}
                    >
                      <Icon name="check" size={11} strokeWidth={3} />
                    </span>
                    Online
                  </span>
                ) : (
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-ink-faint)" }}>
                    Last seen {agoText(r.seenMin)}
                  </span>
                )
              )}
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
                Requested{" "}
                {new Date(r.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
              </span>
            </div>
          </div>

          {!isMe && !t && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={disabled}
                    onClick={() => act(r, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={disabled}
                    onClick={() =>
                      confirmThen(`Reject and remove the request from ${r.staffId}?`, () =>
                        act(r, "reject")
                      )
                    }
                  >
                    Reject
                  </button>
                </>
              )}
              {canManage && r.status === "active" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={disabled}
                  onClick={() =>
                    confirmThen(`Disable ${r.staffId}? They will be signed out.`, () =>
                      act(r, "disable")
                    )
                  }
                >
                  Disable
                </button>
              )}
              {canManage && r.status === "disabled" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={disabled}
                  onClick={() => act(r, "enable")}
                >
                  Enable
                </button>
              )}
              {canReset && r.status !== "pending" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={disabled}
                  onClick={() =>
                    confirmThen(`Set a temporary password for ${r.staffId}?`, () =>
                      act(r, "resetPassword")
                    )
                  }
                >
                  Reset password
                </button>
              )}
              {canManage && r.status !== "pending" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={disabled}
                  onClick={() =>
                    confirmThen(
                      `Permanently delete ${r.staffId}? This cannot be undone.`,
                      () => act(r, "delete")
                    )
                  }
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {t && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" }}>
              Temporary password for {t.staffId} (shown once — note it down now):
            </div>
            <div
              className="mono"
              style={{ fontSize: "var(--font-size-lg)", margin: "6px 0", userSelect: "all" }}
            >
              {t.tempPassword}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setTemp((all) => {
                  const next = { ...all };
                  delete next[r.id];
                  return next;
                })
              }
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {canManage && (
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search staff ID or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          <span className="result-count">{visible.length} shown</span>
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
            Check again
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>
        Account requests ({pending.length})
      </h3>
      {pending.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted)", marginTop: 0 }}>No pending requests.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>{pending.map(card)}</div>
      )}

      {canManage && (
        <>
          <h3 style={{ margin: "24px 0 10px", fontSize: "1rem" }}>
            All users ({others.length})
          </h3>
          <div style={{ display: "grid", gap: 12 }}>{others.map(card)}</div>
        </>
      )}
    </div>
  );
}
