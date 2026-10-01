"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

// Full-screen loading screen shown from the moment sign-in succeeds until the
// next page has arrived. It lives in the root layout (see layout.js), so it
// stays on screen while the route changes from /login to the dashboard
// instead of vanishing the instant the login form unmounts.
//
//   LoginForm    -> window event "permit:signin-start"   shows it
//   LoginForm    -> window event "permit:signin-cancel"  hides it (sign-in stalled)
//   EnterEffect  -> window event "permit:signin-ready"   the dashboard's real
//                   content has arrived, so fade away (cards rise in as it goes)
//   any other destination page: leaving /login hides it (that page's own
//   loading skeleton or finished content is then underneath)
//
// Look: the site's own tokens only (violet in dark, teal in light), a ledger
// "permit badge" inside a turning ring, three honest-looking progress steps,
// and slow water waves along the bottom as a nod to the wastewater/TSE work.
// CSS-only motion (transform/opacity), no libraries, and it renders nothing at
// all while idle. Styles: ".signin-loader" in globals.css.

const STEPS = [
  "Verifying your credentials",
  "Loading the permit register",
  "Preparing your dashboard",
];

const MIN_SHOW_MS = 900; // never flash: stay at least this long
const STEP_MS = 1300; // how often the "current step" moves on
const GIVE_UP_MS = 15000; // safety net if navigation never completes
const FADE_MS = 450; // must match signin-fade-out in globals.css

// One wave = 720 units; the path holds 4 of them (2880 wide) and the svg is
// 200% wide, so sliding it by exactly half loops with no visible seam.
const WAVE_PATH =
  "M0 60 Q180 20 360 60 T720 60 T1080 60 T1440 60 T1800 60 T2160 60 T2520 60 T2880 60 V120 H0 Z";

export default function SignInLoader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState("off"); // off | on | leaving
  const [step, setStep] = useState(0);
  const startedAt = useRef(0);
  const startPath = useRef("");
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const leaveTimer = useRef(null);

  // Fade away, but never before MIN_SHOW_MS so it can't flash.
  function leaveSoon() {
    clearTimeout(leaveTimer.current);
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - startedAt.current));
    leaveTimer.current = setTimeout(
      () => setPhase((p) => (p === "on" ? "leaving" : p)),
      wait
    );
  }

  // Start / cancel / ready signals from the login form and the dashboard.
  useEffect(() => {
    function onStart() {
      clearTimeout(leaveTimer.current);
      startedAt.current = Date.now();
      startPath.current = pathRef.current;
      setStep(0);
      setPhase("on");
    }
    function onCancel() {
      clearTimeout(leaveTimer.current);
      setPhase((p) => (p === "on" ? "leaving" : p));
    }
    function onReady() {
      leaveSoon();
    }
    window.addEventListener("permit:signin-start", onStart);
    window.addEventListener("permit:signin-cancel", onCancel);
    window.addEventListener("permit:signin-ready", onReady);
    return () => {
      clearTimeout(leaveTimer.current);
      window.removeEventListener("permit:signin-start", onStart);
      window.removeEventListener("permit:signin-cancel", onCancel);
      window.removeEventListener("permit:signin-ready", onReady);
    };
    // leaveSoon only touches refs and state setters, so it never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While visible: move the highlighted step along, and give up eventually.
  useEffect(() => {
    if (phase !== "on") return undefined;
    const stepTimer = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      STEP_MS
    );
    const giveUp = setTimeout(() => setPhase("leaving"), GIVE_UP_MS);
    return () => {
      clearInterval(stepTimer);
      clearTimeout(giveUp);
    };
  }, [phase]);

  // Heading anywhere other than the dashboard: leave as soon as the path
  // changes. (For the dashboard, "/" , EnterEffect says when the real content
  // is there, so the loader also covers that page's loading skeleton.)
  useEffect(() => {
    if (phase !== "on") return;
    if (pathname === startPath.current || pathname === "/") return;
    leaveSoon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, phase]);

  // After the fade-out, remove it from the page completely.
  useEffect(() => {
    if (phase !== "leaving") return undefined;
    const t = setTimeout(() => setPhase("off"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "off") return null;

  return (
    <div
      className={`signin-loader${phase === "leaving" ? " signin-loader--leaving" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="signin-loader__water" aria-hidden="true">
        <svg
          className="signin-loader__wave signin-loader__wave--back"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
        >
          <path d={WAVE_PATH} />
        </svg>
        <svg
          className="signin-loader__wave signin-loader__wave--front"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
        >
          <path d={WAVE_PATH} />
        </svg>
      </div>

      <div className="signin-loader__center">
        <div className="signin-loader__badge" aria-hidden="true">
          <svg className="signin-loader__ring" viewBox="0 0 120 120">
            <circle className="signin-loader__ring-track" cx="60" cy="60" r="54" />
            <circle className="signin-loader__ring-arc" cx="60" cy="60" r="54" />
          </svg>
          <span className="signin-loader__icon">
            <Icon name="clipboard" size={32} />
          </span>
        </div>

        <p className="signin-loader__eyebrow">SWWS — Salalah</p>
        <h2 className="signin-loader__title">Permit Log Register</h2>

        <ol className="signin-loader__steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={i < step ? "is-done" : i === step ? "is-active" : ""}
            >
              <span className="signin-loader__mark" aria-hidden="true">
                {i < step ? (
                  <Icon name="checkCircle" size={16} />
                ) : (
                  <span className="signin-loader__dot" />
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <div className="signin-loader__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
