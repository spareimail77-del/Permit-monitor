"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

// Manager dashboard: one headline sentence about the situation, plus a
// button that copies a ready-written status message (for WhatsApp / email).
// The text is built on the server from data already loaded; copying happens
// in the browser only.

export default function ManagerBrief({ tone, headline, sub, summaryText }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(summaryText);
      ok = true;
    } catch (err) {
      // older browsers / blocked clipboard: fall back to a hidden textarea
      try {
        const ta = document.createElement("textarea");
        ta.value = summaryText;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (err2) {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    }
  }

  const icon = tone === "ok" ? "checkCircle" : tone === "soon" ? "clock" : "alertTriangle";

  return (
    <section className={`mine-alert mgr-brief mine-alert--${tone}`} aria-label="Situation overview">
      <div className="mine-alert__head">
        <span className="mine-alert__bell">
          <Icon name={icon} size={16} />
        </span>
        <div className="mine-alert__text">
          <h2 className="mine-alert__title">{headline}</h2>
          <p className="mine-alert__sub">{sub}</p>
        </div>
        <button type="button" className={`mgr-brief__btn${copied ? " is-done" : ""}`} onClick={copy}>
          <Icon name={copied ? "check" : "clipboard"} size={14} />
          <span>{copied ? "Copied" : "Copy summary"}</span>
        </button>
        <Link prefetch={false} href="/permits" className="mine-alert__all">
          Permit list →
        </Link>
      </div>
    </section>
  );
}
