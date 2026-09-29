"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { staffIdToAuthEmail } from "../../lib/staffAuth";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";

const REASON_MESSAGES = {
  pending: "Your account is waiting for approval.",
  disabled: "This account is disabled. Contact HSE.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const reason = searchParams.get("reason");
  const [state, setState] = useState(REASON_MESSAGES[reason] ? "error" : "idle"); // idle | checking | error
  const [message, setMessage] = useState(REASON_MESSAGES[reason] || "");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId || !password) return;
    setState("checking");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: staffIdToAuthEmail(staffId),
      password,
    });

    if (error) {
      setState("error");
      setMessage(
        error.message === "Invalid login credentials"
          ? "Wrong staff ID or password."
          : error.message
      );
      return;
    }

    // Pending and disabled accounts may not sign in.
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userData?.user?.id)
      .single();
    if (profile?.status !== "active") {
      await supabase.auth.signOut();
      setState("error");
      setMessage(REASON_MESSAGES[profile?.status] || REASON_MESSAGES.disabled);
      return;
    }

    // Modern hand-off: the card lifts away under a glowing veil, then the
    // dashboard fades the veil out while its cards rise in (see EnterEffect).
    // Skipped for people who prefer reduced motion.
    const next = searchParams.get("next") || "/";
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      setState("success");
      document.documentElement.dataset.enter = "1";
      // Safety net: clear the flag even if the dashboard never mounts
      // (e.g. the person was sent to another page).
      setTimeout(() => {
        delete document.documentElement.dataset.enter;
      }, 10000);
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
    {state === "success" && <div className="veil veil--in" aria-hidden="true" />}
    <div className={`panel passcode-card${state === "success" ? " is-leaving" : ""}`}>
      <span className="passcode-icon">
        <Icon name="lock" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: "var(--font-size-lg)" }}>
        Permit Log Register
      </h2>
      <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
        Sign in with your staff ID to view the site.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          placeholder="Staff ID"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="passcode-input"
          aria-label="Staff ID"
        />
        <PasswordInput
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!staffId || !password || state === "checking" || state === "success"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {state === "checking" || state === "success" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {state === "error" && (
        <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
          {message}
        </p>
      )}

      <p
        style={{
          margin: "14px 0 0",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: "var(--font-size-sm)",
        }}
      >
        <Link href="/register" style={{ color: "var(--color-brand-2)" }}>
          Create account
        </Link>
        <Link href="/forgot-password" style={{ color: "var(--color-brand-2)" }}>
          Forgot password?
        </Link>
      </p>
    </div>
    </>
  );
}
