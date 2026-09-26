"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import Icon from "../components/Icon";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | checking | error
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setState("checking");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setState("error");
      setMessage(
        error.message === "Invalid login credentials"
          ? "Wrong email or password."
          : error.message
      );
      return;
    }

    const next = searchParams.get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="panel passcode-card">
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>
        Permit Log Register
      </h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        Sign in with your HSE account to view the site.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="passcode-input"
          aria-label="Email"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="passcode-input"
          aria-label="Password"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!email || !password || state === "checking"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {state === "checking" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {message}
        </p>
      )}
    </div>
  );
}
