"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

// Where you are signed in. "Sign out on all devices" ends every session of
// this account, including this one - useful after losing a phone or using a
// shared computer.
export default function SessionCard({ lastSignIn }) {
  const dialogRef = useRef(null);
  const [state, setState] = useState("idle"); // idle | working | error

  useEffect(() => {
    const d = dialogRef.current;
    return () => {
      if (d && d.open) d.close();
    };
  }, []);

  async function signOutEverywhere() {
    setState("working");
    try {
      try {
        window.sessionStorage.removeItem("permit-log-me");
      } catch (err) {
        // storage unavailable - nothing to clear
      }
      const { error } = await createClient().auth.signOut({ scope: "global" });
      if (error) throw error;
      window.location.assign("/login");
    } catch (err) {
      console.error("Global sign-out failed:", err);
      setState("error");
    }
  }

  return (
    <div className="panel pf-card">
      <h3 className="pf-card__title">Sessions</h3>
      <p className="pf-card__sub">
        {lastSignIn ? <>Last sign-in: {lastSignIn} (Oman time).</> : "Where your account is signed in."}
      </p>
      <p className="pf-muted" style={{ margin: "0 0 14px" }}>
        Lost a phone, or signed in on a shared computer? End every session of this account at once.
      </p>
      <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.showModal()}>
        Sign out on all devices
      </button>
      {state === "error" && <p className="error-text">Could not sign out everywhere. Try again.</p>}

      <dialog ref={dialogRef} className="pf-dialog" aria-labelledby="signout-all-title">
        <h4 id="signout-all-title" className="pf-dialog__title">
          Sign out on all devices?
        </h4>
        <p className="pf-muted" style={{ margin: "6px 0 18px" }}>
          You will be signed out here too and will need your Staff ID and password to get back in.
        </p>
        <div className="pf-inline-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={state === "working"} onClick={signOutEverywhere}>
            {state === "working" ? "Signing out…" : "Sign out everywhere"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
        </div>
      </dialog>
    </div>
  );
}
