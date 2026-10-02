"use client";

import { useState } from "react";
import Icon from "../../components/Icon";

// One card per Excel name. Picking an account saves at once. Names with no
// account come first, with a one-click suggestion when a close match exists.
export default function PeopleLinks({ rows: initialRows, accounts, unlinkedAccounts }) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(null); // excel name key
  const [flash, setFlash] = useState({}); // key -> "saved" | error text
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  const labelFor = (id) => accounts.find((a) => a.id === id)?.label || "";
  const total = rows.length;
  const linked = rows.filter((r) => r.userId).length;

  async function save(key, userId) {
    setBusy(key);
    setFlash((f) => ({ ...f, [key]: "" }));
    try {
      const res = await fetch("/api/admin/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excelName: key, userId: userId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash((f) => ({ ...f, [key]: data.error || "Could not save." }));
        return;
      }
      setRows((rs) =>
        rs.map((r) => (r.key === key ? { ...r, userId: userId || null, suggestion: null } : r))
      );
      setFlash((f) => ({ ...f, [key]: "saved" }));
    } catch {
      setFlash((f) => ({ ...f, [key]: "Network error. Try again." }));
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...rows]
    .filter((r) => !onlyUnlinked || !r.userId)
    .sort((a, b) => {
      if (!!a.userId !== !!b.userId) return a.userId ? 1 : -1; // unlinked first
      if (a.inFile !== b.inFile) return a.inFile ? -1 : 1;
      const ta = a.holderCount + a.applicantCount;
      const tb = b.holderCount + b.applicantCount;
      return tb - ta || a.label.localeCompare(b.label);
    });

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={styles.summaryRow}>
        <p style={styles.summary}>
          <strong>{linked}</strong> of <strong>{total}</strong> names linked
        </p>
        <label style={styles.check}>
          <input type="checkbox" checked={onlyUnlinked} onChange={(e) => setOnlyUnlinked(e.target.checked)} />
          Only names without an account
        </label>
      </div>

      {sorted.length === 0 && (
        <div className="panel" style={{ padding: "16px 20px" }}>
          <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
            {total === 0
              ? "No Applicant or Holder names were found in the current file."
              : "Every name is linked. Nice."}
          </p>
        </div>
      )}

      {sorted.map((r) => (
        <div key={r.key} className="panel" style={styles.card}>
          <div style={styles.top}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.name}>{r.label}</div>
              <div style={styles.counts}>
                {r.inFile ? (
                  <>
                    {r.holderCount} as holder · {r.applicantCount} as applicant
                  </>
                ) : (
                  "Not in the current file (link kept in case it returns)"
                )}
              </div>
            </div>
            <div style={styles.pickWrap}>
              <select
                value={r.userId || ""}
                disabled={busy === r.key}
                onChange={(e) => save(r.key, e.target.value)}
                aria-label={`Account for ${r.label}`}
                className="passcode-input"
                style={styles.select}
              >
                <option value="">— not linked —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              {flash[r.key] === "saved" && (
                <span style={styles.saved}>
                  <Icon name="checkCircle" size={14} /> Saved
                </span>
              )}
            </div>
          </div>

          {!r.userId && r.suggestion && (
            <div style={styles.suggest}>
              <span>Looks like</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy === r.key}
                onClick={() => save(r.key, r.suggestion.id)}
              >
                Link to {r.suggestion.label}
              </button>
            </div>
          )}
          {flash[r.key] && flash[r.key] !== "saved" && (
            <p className="error-text" style={{ margin: "8px 0 0" }}>{flash[r.key]}</p>
          )}
        </div>
      ))}

      {unlinkedAccounts.length > 0 && (
        <div className="panel" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "var(--font-size-base)", color: "var(--color-ink)" }}>
            Accounts with no Excel name yet ({unlinkedAccounts.length})
          </h3>
          <p style={{ margin: "0 0 8px", fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
            These people see no personal permits until a name above is linked to them.
          </p>
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)", lineHeight: 1.7 }}>
            {unlinkedAccounts.join("  ·  ")}
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  summary: { margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)" },
  check: { display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-size-sm)", color: "var(--color-ink-muted)", cursor: "pointer" },
  card: { padding: "14px 18px" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" },
  name: { fontWeight: 600, color: "var(--color-ink)", fontSize: "var(--font-size-base)", overflowWrap: "anywhere" },
  counts: { marginTop: 3, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" },
  pickWrap: { display: "flex", alignItems: "center", gap: 10, flex: "1 1 260px", justifyContent: "flex-end" },
  select: { margin: 0, width: "100%", maxWidth: 320, textAlign: "left", letterSpacing: "normal" },
  saved: { display: "flex", alignItems: "center", gap: 4, fontSize: "var(--font-size-xs)", color: "var(--color-open)", whiteSpace: "nowrap" },
  suggest: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid var(--color-rule)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-ink-muted)",
  },
};
