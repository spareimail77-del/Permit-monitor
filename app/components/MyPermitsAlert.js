"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { STATUS_META } from "../../lib/statusMeta";

// Dashboard alert tile for people whose account is linked to Excel names:
// four overview cards and a close button. Browser-only memory:
//   - Closing saves the time in localStorage.
//   - On the next dashboard load, the tile stays away until 10 minutes have
//     passed since it was closed.
//   - Signing in (LoginForm) and signing out (UserMenu) clear that time, so
//     every new login shows the tile again.
// The check runs once, when the page loads. It never re-runs on its own, so
// the tile can not pop back while the dashboard is open.
// `counts` = { active, expiring, overdue, done }, worked out on the server.

export const MINE_ALERT_KEY = "permit-mine-alert-closed-at";
const QUIET_MS = 10 * 60 * 1000;

export default function MyPermitsAlert({ counts }) {
  // "wait" = not checked yet, "open" = showing, "shut" = hidden.
  const [phase, setPhase] = useState("wait");

  useEffect(() => {
    let closedAt = 0;
    try {
      closedAt = Number(window.localStorage.getItem(MINE_ALERT_KEY)) || 0;
    } catch (err) {
      // storage unavailable - just show the tile
    }
    const age = Date.now() - closedAt;
    const quiet = closedAt > 0 && age >= 0 && age < QUIET_MS;
    if (quiet) {
      setPhase("shut");
      return undefined;
    }
    // Let the sign-in cards finish rising before the tile slides down.
    const arriving = document.documentElement.dataset.enter === "1";
    const t = setTimeout(() => setPhase("open"), arriving ? 900 : 120);
    return () => clearTimeout(t);
  }, []);

  function close() {
    try {
      window.localStorage.setItem(MINE_ALERT_KEY, String(Date.now()));
    } catch (err) {
      // storage unavailable - the tile still closes for this page view
    }
    setPhase("shut");
  }

  const total = counts.active + counts.done;
  if (total === 0) return null; // nothing of theirs in the log: nothing to alert

  const tone = counts.overdue > 0 ? "overdue" : counts.expiring > 0 ? "soon" : "ok";
  const headline =
    tone === "overdue"
      ? `${counts.overdue} of your permits ${counts.overdue === 1 ? "is" : "are"} overdue`
      : tone === "soon"
      ? `${counts.expiring} of your permits ${counts.expiring === 1 ? "is" : "are"} expiring soon`
      : "All your permits are on track";
  const open = phase === "open";

  return (
    <div className={`mine-alert-wrap${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="mine-alert-clip">
        <div className="mine-alert-pad">
        <section className={`mine-alert mine-alert--${tone}`} aria-label="My permits">
          <div className="mine-alert__head">
            <span className="mine-alert__bell">
              <Icon name={tone === "ok" ? "checkCircle" : tone === "soon" ? "clock" : "alertTriangle"} size={16} />
            </span>
            <div className="mine-alert__text">
              <h2 className="mine-alert__title">My permits</h2>
              <p className="mine-alert__sub">{headline}</p>
            </div>
            <Link prefetch={false} href="/permits?mine=1" className="mine-alert__all" tabIndex={open ? 0 : -1}>
              View all {total} →
            </Link>
            <button
              type="button"
              className="mine-alert__close"
              onClick={close}
              aria-label="Close my permits alert"
              title="Close"
              tabIndex={open ? 0 : -1}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="mine-alert__cards">
            <AlertCard
              label="Active"
              value={counts.active}
              icon="checkCircle"
              color={STATUS_META.OPEN.color}
              href="/permits?mine=1&status=OPEN"
              open={open}
              n={0}
            />
            <AlertCard
              label="Expiring soon"
              value={counts.expiring}
              icon="clock"
              color={STATUS_META.EXPIRING_SOON.color}
              href="/permits?mine=1&status=EXPIRING_SOON"
              open={open}
              n={1}
            />
            <AlertCard
              label="Overdue"
              value={counts.overdue}
              icon="alertTriangle"
              color={STATUS_META.OVERDUE.color}
              urgent={counts.overdue > 0}
              href="/permits?mine=1&status=OVERDUE"
              open={open}
              n={2}
            />
            <AlertCard
              label="Closed / canceled"
              value={counts.done}
              icon="archive"
              color={STATUS_META.CLOSED.color}
              href="/permits?mine=1&status=ALL"
              open={open}
              n={3}
            />
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ label, value, icon, color, urgent, href, open, n }) {
  return (
    <Link
      prefetch={false}
      href={href}
      tabIndex={open ? 0 : -1}
      className={`mine-alert__card${urgent ? " is-urgent" : ""}${value === 0 ? " is-zero" : ""}`}
      style={{ "--card-color": color, "--n": n }}
    >
      <span className="mine-alert__chip">
        <Icon name={icon} size={16} />
      </span>
      <span className="mine-alert__num">{value}</span>
      <span className="mine-alert__label">{label}</span>
    </Link>
  );
}
