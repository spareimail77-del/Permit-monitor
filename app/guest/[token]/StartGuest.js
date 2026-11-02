"use client";

import { useState } from "react";

// The button that starts a guest view. The page only SHOWS the invitation; nothing is used up
// until this button is pressed (so link previews made by chat apps cannot burn the link).
export default function StartGuest({ token }) {
  const [state, setState] = useState("idle"); // idle | starting | error
  const [message, setMessage] = useState("");

  async function start() {
    if (state === "starting") return;
    setState("starting");
    setMessage("");
    try {
      const res = await fetch("/api/guest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not start. Please try again.");
        return;
      }
      // A full page load, so the new guest session is used from the first screen.
      window.location.href = "/";
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="guest-card__actions">
      <button type="button" className="btn btn-primary" onClick={start} disabled={state === "starting"}>
        {state === "starting" ? "Starting…" : "Start guest view"}
      </button>
      {state === "error" && <p className="error-text" role="alert">{message}</p>}
    </div>
  );
}
