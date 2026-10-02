"use client";

import { useEffect, useRef, useState } from "react";
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

// Only ever follow a link that stays on this site ("/permits", not
// "https://elsewhere" or "//elsewhere").
function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

// The full-screen loader (SignInLoader, mounted in the root layout) listens for
// these two window events.
function startLoader() {
  window.dispatchEvent(new Event("permit:signin-start"));
}
function stopLoader() {
  window.dispatchEvent(new Event("permit:signin-cancel"));
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const reason = searchParams.get("reason");
  const [state, setState] = useState(REASON_MESSAGES[reason] ? "error" : "idle"); // idle | checking | success | error
  const [message, setMessage] = useState(REASON_MESSAGES[reason] || "");
  const reasonAtSubmit = useRef(reason);

  // The server can send a just-signed-in person straight back here with a
  // reason (account turned out to be pending/disabled): show it and drop the
  // loader instead of leaving the form stuck on "Signing in".
  useEffect(() => {
    if (state === "success" && REASON_MESSAGES[reason] && reason !== reasonAtSubmit.current) {
      delete document.documentElement.dataset.enter;
      stopLoader();
      setState("error");
      setMessage(REASON_MESSAGES[reason]);
    }
  }, [reason, state]);

  // Safety net: if the page change never happens, give the form back.
  useEffect(() => {
    if (state !== "success") return undefined;
    const t = setTimeout(() => {
      delete document.documentElement.dataset.enter;
      stopLoader();
      setState("error");
      setMessage("Sign-in is taking too long. Check your connection and try again.");
    }, 20000);
    return () => clearTimeout(t);
  }, [state]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId || !password) return;
    reasonAtSubmit.current = reason;
    setState("checking");
    setMessage("");

    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
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

    // Pending and disabled accounts may not sign in. The sign-in reply
    // already says who just signed in, so no extra getUser() round trip.
    const userId =
      signInData?.user?.id ?? (await supabase.auth.getUser()).data?.user?.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .single();
    if (profile?.status !== "active") {
      await supabase.auth.signOut();
      setState("error");
      setMessage(REASON_MESSAGES[profile?.status] || REASON_MESSAGES.disabled);
      return;
    }

    // Hand-off: the card lifts away, the themed loader covers the screen
    // while the dashboard is fetched, then fades out as the cards rise in.
    // The rise-in is skipped for people who prefer reduced motion (the loader
    // itself stays, just without movement).
    try {
      window.sessionStorage.removeItem("permit-log-me"); // header's cached user
      // Every new sign-in shows the "My permits" alert again.
      window.localStorage.removeItem("permit-mine-alert-closed-at");
    } catch (err) {
      // storage unavailable - nothing to clear
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      document.documentElement.dataset.enter = "1";
      // Safety net: clear the flag even if the dashboard never mounts
      // (e.g. the person was sent to another page).
      setTimeout(() => {
        delete document.documentElement.dataset.enter;
      }, 20000);
    }
    setState("success");
    startLoader();
    // One navigation only. (An extra router.refresh() here used to make the
    // server render the dashboard a second time.)
    router.replace(safeNext(searchParams.get("next")));
  }

  const busy = state === "checking" || state === "success";

  return (
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
          disabled={!staffId || !password || busy}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {busy && <span className="btn-spinner" aria-hidden="true" />}
          {busy ? "Signing in…" : "Sign in"}
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
        <Link prefetch={false} href="/register" style={{ color: "var(--color-brand-2)" }}>
          Create account
        </Link>
        <Link prefetch={false} href="/forgot-password" style={{ color: "var(--color-brand-2)" }}>
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
