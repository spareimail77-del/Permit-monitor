"use client";

import { useCallback, useEffect, useState } from "react";
import ExpiringWatchlist from "./ExpiringWatchlist";

// Dashboard right-hand panel: two tabs, Overdue and Expiring soon.
//
// It feels alive: every ROTATE_MS the panel glides from one tab to the other.
// Both lists stay mounted and stacked in one grid cell, so the outgoing one
// fades and slides away while the incoming one slides in, and the panel
// never changes height. A thin line along the active tab shows the time
// left before the next glide (it is a CSS animation; when it ends, we
// switch, so the line and the switch can never drift apart).
//
// Rotation pauses while the mouse is over the panel, while keyboard focus is
// inside it, while the browser tab is hidden, and for MANUAL_HOLD_MS after
// the person clicks or touches a tab. It does not rotate at all when a tab
// is empty or the person prefers reduced motion. All of this is browser-side;
// no extra server work.

const ROTATE_MS = 8000;
const MANUAL_HOLD_MS = 30000;
const TABS = ["overdue", "expiring"];

export default function AttentionPanel({
  overdue,
  overdueTotal,
  expiring,
  expiringTotal,
}) {
  const [tab, setTab] = useState(overdueTotal > 0 ? "overdue" : "expiring");
  const [cycle, setCycle] = useState(0); // restarts the progress line
  const [hover, setHover] = useState(false);
  const [kbFocus, setKbFocus] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [held, setHeld] = useState(false); // manual 30 s hold
  const [reduced, setReduced] = useState(false);

  const canRotate = overdueTotal > 0 && expiringTotal > 0 && !reduced;
  const paused = hover || kbFocus || hidden;
  const activeIndex = TABS.indexOf(tab);

  // Reduced motion preference.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Browser tab hidden -> pause (and resume from where it stopped).
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // After a manual choice, wait 30 s, then start a fresh 8 s cycle.
  useEffect(() => {
    if (!held) return undefined;
    const t = setTimeout(() => {
      setHeld(false);
      setCycle((c) => c + 1);
    }, MANUAL_HOLD_MS);
    return () => clearTimeout(t);
  }, [held, cycle]);

  const choose = useCallback(
    (next) => {
      setTab(next);
      setCycle((c) => c + 1);
      setHeld(true);
    },
    []
  );

  const advance = useCallback(() => {
    setTab((cur) => (cur === "overdue" ? "expiring" : "overdue"));
    setCycle((c) => c + 1);
  }, []);

  const showBar = canRotate && !held;

  const tabButton = (id, label, count) => {
    const selected = tab === id;
    return (
      <button
        type="button"
        role="tab"
        id={`attn-tab-${id}`}
        aria-selected={selected}
        aria-controls={`attn-pane-${id}`}
        className={`attn-tab attn-tab--${id}`}
        onClick={() => choose(id)}
        onTouchStart={() => setHeld(true)}
      >
        {label} <span className="attn-tab__count">{count}</span>
        {selected && showBar && (
          <span
            key={`${id}-${cycle}`}
            className="attn-tab__bar"
            style={{
              animationDuration: `${ROTATE_MS}ms`,
              animationPlayState: paused ? "paused" : "running",
            }}
            onAnimationEnd={advance}
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  const paneClass = (index) =>
    `attn-pane${
      index === activeIndex ? " is-active" : index < activeIndex ? " is-before" : " is-after"
    }`;

  return (
    <div
      className="attn"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocus={(e) => {
        if (e.target.matches?.(":focus-visible")) setKbFocus(true);
      }}
      onBlur={() => setKbFocus(false)}
    >
      <h2 className="panel-title">Needs attention</h2>

      <div className="attn-subs">
        <p className={`panel-subtitle attn-sub${tab === "overdue" ? " is-active" : ""}`}>
          Still open past their Valid To date, most overdue first.
        </p>
        <p className={`panel-subtitle attn-sub${tab === "expiring" ? " is-active" : ""}`}>
          Open permits with 3 days or less left, soonest first.
        </p>
      </div>

      <div className="attn-tabs" role="tablist" aria-label="Needs attention">
        {tabButton("overdue", "Overdue", overdueTotal)}
        {tabButton("expiring", "Expiring soon", expiringTotal)}
      </div>

      <div className="dash-panel__body attn-stage">
        <div
          className={paneClass(0)}
          id="attn-pane-overdue"
          role="tabpanel"
          aria-labelledby="attn-tab-overdue"
          aria-hidden={tab !== "overdue"}
        >
          <ExpiringWatchlist
            mode="overdue"
            permits={overdue}
            totalCount={overdueTotal}
            viewAllHref="/permits?status=OVERDUE"
          />
        </div>
        <div
          className={paneClass(1)}
          id="attn-pane-expiring"
          role="tabpanel"
          aria-labelledby="attn-tab-expiring"
          aria-hidden={tab !== "expiring"}
        >
          <ExpiringWatchlist
            mode="expiring"
            permits={expiring}
            totalCount={expiringTotal}
            viewAllHref="/permits?status=EXPIRING_SOON"
          />
        </div>
      </div>
    </div>
  );
}
