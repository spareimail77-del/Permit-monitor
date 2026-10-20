"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Dashboard tile with two views of the open permits:
//  - Timeline: one bar per permit, from "Valid from" to "Valid to", on a day axis that starts today.
//  - Per day:  how many permits end on each day, stacked by type; tap a bar to list them.
// Overdue permits are not here (they have their own tile).
//   items: [{ id, reference, area, location, type, from, to, daysLeft }]
//   today: "YYYY-MM-DD" (Oman)

const RANGES = [14, 30];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMs = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayDiff = (a, b) => Math.round((toMs(b) - toMs(a)) / 86400000);
const addDays = (iso, n) => new Date(toMs(iso) + n * 86400000).toISOString().slice(0, 10);
const short = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
const full = (iso) => iso.split("-").reverse().join("-");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
// Weekend in Oman: Friday and Saturday.
const isWeekend = (iso) => {
  const d = new Date(toMs(iso)).getUTCDay();
  return d === 5 || d === 6;
};

function tone(daysLeft) {
  if (daysLeft <= 1) return "hot";
  if (daysLeft <= 3) return "warm";
  return "calm";
}
function typeColor(t) {
  const u = String(t || "").toUpperCase();
  if (u.includes("HOT")) return "var(--danger)";
  if (u.includes("BLANKET")) return "var(--warn)";
  if (u.includes("COLD")) return "var(--brand)";
  return "var(--ink-muted)";
}

export default function PermitTimeline({ items, today }) {
  const [view, setView] = useState("timeline");
  const [range, setRange] = useState(30);
  const [picked, setPicked] = useState(null); // a day (ISO) chosen in the Per day view

  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDays(today, i)), [today, range]);

  // ---- timeline rows ----
  const rows = useMemo(() => {
    return items
      .map((p) => {
        const s = dayDiff(today, p.from || today);
        const e = dayDiff(today, p.to);
        return { ...p, s: Math.max(0, s), e: Math.min(range - 1, e), clipR: e > range - 1, clipL: s < 0, startsLater: s > 0 };
      })
      .filter((p) => p.s <= range - 1 && p.e >= 0 && p.s <= p.e)
      .sort((a, b) => a.daysLeft - b.daysLeft || a.reference.localeCompare(b.reference));
  }, [items, today, range]);

  // ---- per day counts ----
  const perDay = useMemo(() => {
    const map = new Map(days.map((d) => [d, []]));
    for (const p of items) if (map.has(p.to)) map.get(p.to).push(p);
    return days.map((d) => ({ d, list: map.get(d) }));
  }, [items, days]);
  const maxN = Math.max(1, ...perDay.map((x) => x.list.length));
  const typesHere = useMemo(() => {
    const set = new Set();
    for (const x of perDay) for (const p of x.list) set.add(p.type || "Other");
    return [...set].sort();
  }, [perDay]);
  const pickedList = picked ? perDay.find((x) => x.d === picked)?.list || [] : [];

  const total = items.length;

  return (
    <div className="panel pform-card tl-card">
      <div className="tl-top">
        <h2 className="pform-title">{view === "timeline" ? "Permit timeline" : "Ending per day"}</h2>
        <div className="tl-controls">
          <div className="seg-ctl" role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={view === "timeline"} className={view === "timeline" ? "is-on" : ""} onClick={() => setView("timeline")}>
              Timeline
            </button>
            <button type="button" role="tab" aria-selected={view === "perday"} className={view === "perday" ? "is-on" : ""} onClick={() => setView("perday")}>
              Per day
            </button>
          </div>
          <div className="seg-ctl" role="group" aria-label="Days shown">
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={range === r} className={range === r ? "is-on" : ""} onClick={() => { setRange(r); setPicked(null); }}>
                {r} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {total === 0 ? (
        <p className="empty empty--compact">No open permits.</p>
      ) : view === "timeline" ? (
        <>
          <div className="tl-scroll">
            <div className="tl" style={{ "--n": range }}>
              <div className="tl-head">
                <div className="tl-corner">Permit</div>
                <div className="tl-axis">
                  {days.map((d, i) => (
                    <span key={d} className={`tl-day${i === 0 ? " is-today" : ""}${isWeekend(d) ? " is-we" : ""}`}>
                      <b>{d.slice(8, 10)}</b>
                      <i>{range <= 14 ? WD[new Date(toMs(d)).getUTCDay()] : WD[new Date(toMs(d)).getUTCDay()][0]}</i>
                    </span>
                  ))}
                </div>
              </div>

              <div className="tl-body">
                <div className="tl-grid" aria-hidden="true">
                  {days.map((d, i) => (
                    <span key={d} className={`${isWeekend(d) ? "is-we" : ""}${i === 0 ? " is-today" : ""}`} />
                  ))}
                </div>
                {rows.length === 0 ? (
                  <p className="empty empty--compact tl-empty">No permits in these {range} days.</p>
                ) : (
                  rows.map((r) => {
                    const span = r.e - r.s + 1;
                    const left = (r.s / range) * 100;
                    const width = (span / range) * 100;
                    const inside = span >= 8;
                    const nearEnd = r.e >= range - 6;
                    const label = `${short(r.to)} · ${r.daysLeft}d`;
                    return (
                      <div key={r.id} className="tl-row">
                        <Link href={`/permits/${r.id}`} className="tl-label" title={`${r.reference} · ${r.location || ""}`}>
                          <span className="tl-ref mono">{r.reference}</span>
                          <span className="tl-loc">{r.location || "—"}</span>
                        </Link>
                        <div className="tl-track">
                          <Link
                            href={`/permits/${r.id}`}
                            className={`tl-bar tl-bar--${tone(r.daysLeft)}${r.clipR ? " is-clipR" : ""}${r.clipL ? " is-clipL" : ""}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${r.reference} · ${r.type || ""} · ${full(r.from || today)} → ${full(r.to)} (${r.daysLeft === 0 ? "ends today" : plural(r.daysLeft, "day") + " left"})`}
                          >
                            {inside && <span className="tl-bar__t">{r.clipR ? `${r.type || ""}` : label}</span>}
                          </Link>
                          {!inside && (
                            <span
                              className="tl-out"
                              style={nearEnd ? { right: `${100 - left}%`, marginRight: 6 } : { left: `${left + width}%`, marginLeft: 6 }}
                            >
                              {label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <p className="pform-hint card-foot">
            Each bar runs from Valid from to Valid to. Colour: red 0 to 1 days left, amber 2 to 3, green more. Shaded columns are Friday and Saturday. An arrow edge means the permit
            continues past this window.
          </p>
        </>
      ) : (
        <>
          <div className="tl-scroll">
            <div className="pd-chart" style={{ "--n": range }}>
              {perDay.map((x, i) => {
                const n = x.list.length;
                const byType = new Map();
                for (const p of x.list) byType.set(p.type || "Other", (byType.get(p.type || "Other") || 0) + 1);
                const selected = picked === x.d;
                return (
                  <button
                    key={x.d}
                    type="button"
                    className={`pd-col${isWeekend(x.d) ? " is-we" : ""}${i === 0 ? " is-today" : ""}${selected ? " is-picked" : ""}`}
                    onClick={() => n > 0 && setPicked(selected ? null : x.d)}
                    disabled={n === 0}
                    aria-label={`${full(x.d)}: ${plural(n, "permit")} ending`}
                    title={`${full(x.d)} · ${plural(n, "permit")}`}
                  >
                    <span className="pd-n">{n || ""}</span>
                    <span className="pd-stack">
                      {n === 0 ? (
                        <span className="pd-dot" />
                      ) : (
                        [...byType.entries()].map(([t, c]) => (
                          <span key={t} className="pd-seg" style={{ height: `${(c / maxN) * 100}%`, background: typeColor(t) }} />
                        ))
                      )}
                    </span>
                    <span className="pd-d">
                      <b>{x.d.slice(8, 10)}</b>
                      <i>{range <= 14 ? WD[new Date(toMs(x.d)).getUTCDay()] : WD[new Date(toMs(x.d)).getUTCDay()][0]}</i>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pd-legend">
            {typesHere.map((t) => (
              <span key={t} className="pd-key">
                <span className="pd-key__sw" style={{ background: typeColor(t) }} />
                {t}
              </span>
            ))}
          </div>

          {picked ? (
            <div className="pd-list">
              <p className="pd-list__h">
                Ending on <strong>{full(picked)}</strong> · {plural(pickedList.length, "permit")}
              </p>
              <ul className="ns-list">
                {pickedList.map((r) => (
                  <li key={r.id} className="ns-row">
                    <Link href={`/permits/${r.id}`} className="ns-ref mono" aria-label={`Open permit ${r.reference}`}>
                      {r.reference}
                    </Link>
                    <span className="ns-where">
                      <span className="ns-loc">{r.location || "—"}</span>
                      <span className="ns-meta">{[r.area, r.type].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                    <span className="ns-date">
                      <span className="ns-date__l">from</span>
                      {r.from ? full(r.from) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="pform-hint card-foot">Tap a bar to see the permits that end that day. Open permits only; overdue permits are not included.</p>
          )}
        </>
      )}
    </div>
  );
}
