"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Dashboard tile "Needs attention" with two tabs.
//  - Overdue:  most overdue first, grouped by "N days overdue".
//  - Expiring: every open permit, the one ending first at the top, grouped by
//              "Ends today / 1 day remaining / 2 days remaining ...", down to the last permit.
// The list scrolls inside the tile; the tile is sized by the dashboard grid.
//   rows: [{ id, reference, location, holder, type, validTo, daysLeft, daysOverdue }]

const fmt = (iso) => (iso ? iso.split("-").reverse().join("-") : "—");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function groupBy(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([k, items]) => ({ k, items }));
}

function heading(tab, k) {
  if (tab === "overdue") return `${plural(k, "day")} overdue`;
  if (k === 0) return "Ends today";
  return `${plural(k, "day")} remaining`;
}

// red: overdue, today or tomorrow; amber: 2-3 days; green: more.
function tone(tab, k) {
  if (tab === "overdue" || k <= 1) return "hot";
  if (k <= 3) return "warm";
  return "calm";
}

export default function NeedsAttention({ overdue, expiring, overdueHref }) {
  const [tab, setTab] = useState(overdue.length > 0 || expiring.length === 0 ? "overdue" : "expiring");

  const groups = useMemo(() => {
    if (tab === "overdue") {
      const rows = [...overdue].sort((a, b) => b.daysOverdue - a.daysOverdue);
      return groupBy(rows, (r) => r.daysOverdue);
    }
    const rows = [...expiring].sort((a, b) => a.daysLeft - b.daysLeft);
    return groupBy(rows, (r) => r.daysLeft);
  }, [tab, overdue, expiring]);

  const total = tab === "overdue" ? overdue.length : expiring.length;

  return (
    <div className="panel pform-card ns">
      <div className="ns-tabs" role="tablist" aria-label="Needs attention">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overdue"}
          className={`ns-tab ns-tab--bad${tab === "overdue" ? " is-on" : ""}`}
          onClick={() => setTab("overdue")}
        >
          Overdue <span className="ns-count">{overdue.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "expiring"}
          className={`ns-tab ns-tab--warn${tab === "expiring" ? " is-on" : ""}`}
          onClick={() => setTab("expiring")}
        >
          Expiring <span className="ns-count">{expiring.length}</span>
        </button>
      </div>

      <div className="ns-body">
        {total === 0 ? (
          <p className="empty empty--compact">{tab === "overdue" ? "No overdue permits." : "No open permits."}</p>
        ) : (
          <div className="ns-scroll" tabIndex={0} aria-label={tab === "overdue" ? "Overdue permits" : "Permits by days remaining"}>
            {groups.map(({ k, items }) => (
              <section key={`${tab}-${k}`} className="ns-group">
                <h3 className={`ns-head ns-head--${tone(tab, k)}`}>
                  <span className="ns-dot" aria-hidden="true" />
                  {heading(tab, k)}
                  <span className="ns-head__n">{items.length}</span>
                </h3>
                <ul className="ns-list">
                  {items.map((r) => (
                    <li key={r.id} className="ns-row">
                      <Link href={`/permits/${r.id}`} className="ns-ref mono" aria-label={`Open permit ${r.reference}`}>
                        {r.reference}
                      </Link>
                      <span className="ns-where">
                        <span className="ns-loc">{r.location || "—"}</span>
                        <span className="ns-meta">{[r.holder, r.type].filter(Boolean).join(" · ") || "—"}</span>
                      </span>
                      <span className="ns-date">
                        <span className="ns-date__l">{tab === "overdue" ? "ended" : "ends"}</span>
                        {fmt(r.validTo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {tab === "overdue" && total > 0 && (
        <p className="ns-foot">
          <Link href={overdueHref} className="more-link">
            Open in permit list
          </Link>
        </p>
      )}
    </div>
  );
}
