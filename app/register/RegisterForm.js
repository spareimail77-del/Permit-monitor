"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../components/Icon";
import { PASSWORD_MIN } from "../../lib/authRules";

export default function RegisterForm() {
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, left empty by people
  const [state, setState] = useState("idle"); // idle | sending | error | done
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setState("error");
      setMessage("The two passwords do not match.");
      return;
    }
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, name, password, website }),
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

  if (state === "done") {
    return (
      <div className="panel passcode-card">
        <span className="passcode-icon">
          <Icon name="lock" />
        </span>
        <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Request sent</h2>
        <p style={styles.muted}>
          Your account is waiting for approval. You can sign in once it has been approved.
        </p>
        <Link href="/login" className="btn btn-primary" style={styles.fullBtn}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>Create account</h2>
      <p style={styles.muted}>An admin must approve your request before you can sign in.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          type="text"
          autoComplete="username"
          placeholder="Staff ID"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="passcode-input"
          aria-label="Staff ID"
          maxLength={12}
        />
        <input
          type="text"
          autoComplete="name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="passcode-input"
          aria-label="Name"
          maxLength={40}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder={`Password (min ${PASSWORD_MIN} characters)`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="passcode-input"
          aria-label="Password"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="passcode-input"
          aria-label="Confirm password"
        />
        {/* Honeypot: hidden from people, tempting to bots. */}
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
          disabled={!staffId || !name || !password || !confirm || state === "sending"}
          style={styles.fullBtn}
        >
          {state === "sending" ? "Sending…" : "Request account"}
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
    </div>
  );
}

const styles = {
  muted: { margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" },
  fullBtn: { width: "100%", justifyContent: "center", marginTop: 12, textDecoration: "none" },
  link: { color: "var(--color-brand-2)" },
};
