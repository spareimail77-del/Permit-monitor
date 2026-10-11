"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_ROLES, ROLE_LABELS } from "../../../lib/permissions";
import TempPasswordNotice from "../TempPasswordNotice";

const STATUS_TEXT = { pending: "Waiting", active: "Active", disabled: "Disabled" };

// Defined outside UsersList so inputs keep focus while typing.
function RoleSelect({ value, onChange, disabled }) {
  return (
    <select className="pform-input" style={{ width: "auto", padding: "5px 8px" }} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {ALL_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function UserRow({ user, isSelf, busy, onAction }) {
  // The role chosen for a waiting account, before approving.
  const [pendingRole, setPendingRole] = useState(user.role);
  const waiting = user.status === "pending";

  return (
    <tr>
      <td>
        <strong className="mono">{user.staffId}</strong>
        {isSelf && <span className="badge" style={{ marginLeft: 8 }}>you</span>}
        <div className="pform-hint">{user.name || "—"}</div>
      </td>
      <td>
        {waiting ? (
          <RoleSelect value={pendingRole} onChange={setPendingRole} disabled={busy} />
        ) : (
          <RoleSelect value={user.role} onChange={(role) => onAction(user, { action: "set_role", role })} disabled={busy || isSelf} />
        )}
      </td>
      <td>
        <span className={`badge badge--${user.status}`}>{STATUS_TEXT[user.status] || user.status}</span>
        {user.mustChange && <div className="pform-hint">must change password</div>}
      </td>
      <td className="pform-hint">{user.created}</td>
      <td>
        <div className="row-actions">
          {waiting && (
            <>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAction(user, { action: "approve", role: pendingRole })}>
                Approve
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => onAction(user, "delete", `Reject and remove the request from ${user.staffId}?`)}>
                Reject
              </button>
            </>
          )}
          {user.status === "active" && !isSelf && (
            <button className="btn btn-sm" disabled={busy} onClick={() => onAction(user, { action: "disable" }, `Disable ${user.staffId}? They will be signed out on their next click.`)}>
              Disable
            </button>
          )}
          {user.status === "disabled" && (
            <button className="btn btn-sm" disabled={busy} onClick={() => onAction(user, { action: "enable" })}>
              Enable
            </button>
          )}
          {!waiting && (
            <button className="btn btn-sm" disabled={busy} onClick={() => onAction(user, { action: "reset_password" }, `Set a new temporary password for ${user.staffId}?`)}>
              Reset password
            </button>
          )}
          {!waiting && !isSelf && (
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => onAction(user, "delete", `Delete the account ${user.staffId} for good? This cannot be undone.`)}>
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function UsersList({ users, selfId }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [temp, setTemp] = useState(null); // { staffId, password }

  async function onAction(user, what, confirmText) {
    if (busyId) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(user.id);
    setError("");
    try {
      const isDelete = what === "delete";
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: isDelete ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: isDelete ? undefined : JSON.stringify(what),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "The change could not be saved.");
      } else {
        if (data.tempPassword) setTemp({ staffId: data.staffId, password: data.tempPassword });
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...users].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));

  return (
    <>
      {temp && <TempPasswordNotice staffId={temp.staffId} password={temp.password} onClose={() => setTemp(null)} />}
      {error && <div className="notice notice--danger">{error}</div>}
      <div className="panel table-wrap">
        {sorted.length === 0 ? (
          <p className="empty">No accounts yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Staff ID / name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Requested (Oman time)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === selfId} busy={busyId === u.id} onAction={onAction} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
