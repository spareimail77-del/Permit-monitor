"use client";

import { useState } from "react";

export default function RetentionForm({ initialDays }) {
  const [days, setDays] = useState(initialDays);
  const [state, setState] = useState("idle"); // idle | saving | saved | error
  const [message, setMessage] = useState("");

  async function save(next) {
    const previous = days;
    setDays(next);
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/admin/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDays(previous);
        setState("error");
        setMessage(data.error || "Could not save.");
        return;
      }
      setState("saved");
    } catch {
      setDays(previous);
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label htmlFor="retention" style={{ fontSize: "var(--font-size-sm)" }}>
        Keep the log for
      </label>
      <select
        id="retention"
        value={days}
        disabled={state === "saving"}
        onChange={(e) => save(Number(e.target.value))}
        style={{
          padding: "6px 10px",
          border: "1px solid var(--color-rule-strong)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-surface)",
          color: "var(--color-ink)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <option value={3}>3 days</option>
        <option value={5}>5 days</option>
        <option value={7}>7 days</option>
      </select>
      {state === "saved" && (
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          Saved. Older entries were removed.
        </span>
      )}
      {state === "error" && <span className="error-text">{message}</span>}
    </div>
  );
}
