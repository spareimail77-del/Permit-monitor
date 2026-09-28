"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../components/Icon";

export default function ForgotForm() {
  const [staffId, setStaffId] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState("idle"); // idle | sending | error | done
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not send the request.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Forgot password</h2>

      {state === "done" ? (
        <>
          <p style={styles.muted}>
            If that Staff ID has an active account, an admin has been notified. They will give you
            a temporary password, and you will be asked to choose a new one when you sign in.
          </p>
          <Link href="/login" className="btn btn-primary" style={styles.fullBtn}>
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p style={styles.muted}>
            Enter your Staff ID. An admin will set a temporary password for you.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="Staff ID"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="passcode-input"
              aria-label="Staff ID"
              maxLength={12}
            />
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0 }}
              aria-hidden="true"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!staffId || state === "sending"}
              style={styles.fullBtn}
            >
              {state === "sending" ? "Sending…" : "Send request"}
            </button>
          </form>
          {state === "error" && (
            <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
              {message}
            </p>
          )}
          <p style={{ ...styles.muted, marginTop: 14 }}>
            <Link href="/login" style={styles.link}>Back to sign in</Link>
          </p>
        </>
      )}
    </div>
  );
}

const styles = {
  muted: { margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" },
  fullBtn: { width: "100%", justifyContent: "center", marginTop: 12, textDecoration: "none" },
  link: { color: "var(--color-brand-2)" },
};
