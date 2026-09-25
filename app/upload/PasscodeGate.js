"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../components/Icon";

export default function PasscodeGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | checking | error
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setState("checking");
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Incorrect passcode.");
        return;
      }

      // Cookie is set — reload the server component so it renders
      // the real upload form.
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>
        HSE access only
      </h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        Enter the HSE upload passcode to replace the permit log file.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode="text"
          autoComplete="off"
          autoFocus
          placeholder="Passcode"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="passcode-input"
          aria-label="HSE upload passcode"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!password || state === "checking"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {state === "checking" ? "Checking…" : "Unlock upload"}
        </button>
      </form>

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
