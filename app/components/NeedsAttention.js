"use client";

import { useState } from "react";
import Link from "next/link";

// One dashboard tile with two tabs: Overdue and Expiring.
// The Expiring tab looks 7 days ahead (not only the "Expiring soon" status, which
// is 0-3 days) and groups the permits by how many days are left.
//   rows: [{ id, reference, location, holder, type, validTo, daysLeft, daysOverdue }]

const SHOW = 6; // rows shown before "Show more"

const BUCKETS = [
  { key: "all", label: "All 7 days", test: () => true },
  { key: "d1", label: "1 day", sub: "today & tomorrow", test: (d) => d <= 1 },
  { key: "d3", label: "3 days", sub: "2 – 3 days left", test: (d) => d >= 2 && d <= 3 },
  { key: "d7", label: "7 days", sub: "4 – 7 days left", test: (d) => d >= 4 && d <= 7 },
];

const fmt = (iso) => (iso ? iso.split("-").reverse().join("-") : "—");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function leftText(d) {
  if (d === 0) return "Ends today";
  return `${plural(d, "day")} left`;
}
function tone(d) {
  if (d <= 1) return "hot";
  if (d <= 3) return "warm";
  return "calm";
}

function Row({ r, kind }) {
  const overdue = kind === "overdue";
  const t = overdue ? "bad" : tone(r.daysLeft);
  return (
    <li className={`ns-row ns-row--${t}`}>
      <Link href={`/permits/${r.id}`} className="ns-ref mono" aria-label={`Open permit ${r.reference}`}>
        {r.reference}
      </Link>
      <span className="ns-where">
        <span className="ns-loc">{r.location || "—"}</span>
        <span className="ns-meta">
          {[r.holder, r.type].filter(Boolean).join(" · ")}
          {r.validTo ? ` · ends ${fmt(r.validTo)}` : ""}
        </span>
      </span>
      <span className={`ns-pill ns-pill--${t}`}>{overdue ? `${plural(r.daysOverdue, "day")} overdue` : leftText(r.daysLeft)}</span>
    </li>
  );
}

export default function NeedsAttention({ overdue, expiring, overdueHref }) {
  const [tab, setTab] = useState(overdue.length > 0 || expiring.length === 0 ? "overdue" : "expiring");
  const [bucket, setBucket] = useState("all");
  const [more, setMore] = useState(false);

  const b = BUCKETS.find((x) => x.key === bucket) || BUCKETS[0];
  const expShown = expiring.filter((r) => b.test(r.daysLeft));
  const list = tab === "overdue" ? overdue : expShown;
  const visible = more ? list : list.slice(0, SHOW);

  function pickTab(t) {
    setTab(t);
    setMore(false);
  }
  function pickBucket(k) {
    setBucket(k);
    setMore(false);
  }

  return (
    <div className="panel pform-card ns">
      <div className="ns-tabs" role="tablist" aria-label="Needs attention">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overdue"}
          className={`ns-tab ns-tab--bad${tab === "overdue" ? " is-on" : ""}`}
          onClick={() => pickTab("overdue")}
        >
          Overdue <span className="ns-count">{overdue.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "expiring"}
          className={`ns-tab ns-tab--warn${tab === "expiring" ? " is-on" : ""}`}
          onClick={() => pickTab("expiring")}
        >
          Expiring <span className="ns-count">{expiring.length}</span>
        </button>
      </div>

      {tab === "expiring" && (
        <div className="ns-chips" role="group" aria-label="Days left">
          {BUCKETS.map((x) => {
            const n = expiring.filter((r) => x.test(r.daysLeft)).length;
            return (
              <button
                key={x.key}
                type="button"
                className={`ns-chip${bucket === x.key ? " is-on" : ""}`}
                aria-pressed={bucket === x.key}
                onClick={() => pickBucket(x.key)}
              >
                <span className="ns-chip__l">{x.label}</span>
                <span className="ns-chip__n">{n}</span>
                {x.sub && <span className="ns-chip__s">{x.sub}</span>}
              </button>
            );
          })}
        </div>
      )}

      {list.length === 0 ? (
        <p className="empty empty--compact">
          {tab === "overdue" ? "No overdue permits." : bucket === "all" ? "Nothing ends in the next 7 days." : "No permits in this group."}
        </p>
      ) : (
        <>
          <ul className="ns-list">
            {visible.map((r) => (
              <Row key={r.id} r={r} kind={tab} />
            ))}
          </ul>
          <div className="ns-foot">
            {list.length > SHOW && (
              <button type="button" className="ns-more" onClick={() => setMore((m) => !m)}>
                {more ? "Show less" : `Show all ${list.length}`}
              </button>
            )}
            {tab === "overdue" && list.length > 0 && (
              <Link href={overdueHref} className="ns-more ns-more--link">
                Open in permit list
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
