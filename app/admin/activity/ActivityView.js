"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "../../components/Icon";
import {
  ago,
  buildSessions,
  clock,
  dayHeading,
  dayKey,
  describePath,
  durationText,
  exactTime,
  groupByDay,
  summarize,
  weekdayShort,
} from "../../../lib/activityView";

const DATE_CHIPS = [
  ["all", "All"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
];
const TYPE_CHIPS = [
  ["all", "All pages"],
  ["permits", "Permits"],
  ["admin", "Admin"],
  ["upload", "Upload"],
];

export default function ActivityView({ rows, names, me, now }) {
  const [range, setRange] = useState("all");
  const [type, setType] = useState("all");
  const [user, setUser] = useState("");
  const [hideMine, setHideMine] = useState(false);
  const [open, setOpen] = useState(() => new Set());

  const summary = useMemo(() => summarize(rows, now), [rows, now]);
  const people = useMemo(() => [...new Set(rows.map((r) => r.s))].sort(), [rows]);

  const groups = useMemo(() => {
    const today = dayKey(now);
    const yesterday = dayKey(now - 86400000);
    const kept = rows.filter((r) => {
      if (user && r.s !== user) return false;
      if (hideMine && r.s === me) return false;
      if (type !== "all" && describePath(r.p).type !== type) return false;
      const k = dayKey(r.t);
      if (range === "today" && k !== today) return false;
      if (range === "yesterday" && k !== yesterday) return false;
      return true;
    });
    return { list: groupByDay(buildSessions(kept)), count: kept.length };
  }, [rows, now, range, type, user, hideMine, me]);

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const maxDay = Math.max(1, ...summary.days.map((d) => d.n));
  const sessionCount = groups.list.reduce((n, g) => n + g.sessions.length, 0);

  return (
    <>
      <div className="act-stats">
        <div className="panel act-stat">
          <span className="act-stat__label">People today</span>
          <strong className="act-stat__value">{summary.peopleToday}</strong>
        </div>
        <div className="panel act-stat">
          <span className="act-stat__label">Page views today</span>
          <strong className="act-stat__value">{summary.viewsToday}</strong>
        </div>
        <div className="panel act-stat">
          <span className="act-stat__label">Most visited page</span>
          <strong className="act-stat__value act-stat__value--text">
            {summary.topPage ? summary.topPage.label : "—"}
          </strong>
          {summary.topPage && <span className="act-stat__sub">{summary.topPage.n} visits</span>}
        </div>
        <div className="panel act-stat">
          <span className="act-stat__label">Busiest hour</span>
          <strong className="act-stat__value act-stat__value--text">
            {summary.busyHour
              ? `${String(summary.busyHour.hour).padStart(2, "0")}:00`
              : "—"}
          </strong>
          {summary.busyHour && <span className="act-stat__sub">{summary.busyHour.n} visits</span>}
        </div>
      </div>

      {summary.days.length > 0 && (
        <div className="panel act-chart" aria-label="Visits per day">
          {summary.days.map((d) => (
            <div key={d.key} className="act-chart__col" title={`${d.key}: ${d.n} visits`}>
              <span className="act-chart__n">{d.n}</span>
              <div className="act-chart__bar" style={{ height: `${Math.max(3, (d.n / maxDay) * 100)}%` }} />
              <span className="act-chart__day">{weekdayShort(d.key)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="act-filters">
        <div className="act-chips" role="group" aria-label="Date">
          {DATE_CHIPS.map(([v, l]) => (
            <button key={v} type="button" className={`act-chip${range === v ? " is-on" : ""}`}
              aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
        <div className="act-chips" role="group" aria-label="Page type">
          {TYPE_CHIPS.map(([v, l]) => (
            <button key={v} type="button" className={`act-chip${type === v ? " is-on" : ""}`}
              aria-pressed={type === v} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
        <select value={user} onChange={(e) => setUser(e.target.value)} aria-label="Person">
          <option value="">Everyone</option>
          {people.map((s) => (
            <option key={s} value={s}>{names[s] ? `${names[s]} (${s})` : s}</option>
          ))}
        </select>
        <label className="act-check">
          <input type="checkbox" checked={hideMine} onChange={(e) => setHideMine(e.target.checked)} />
          Hide my own visits
        </label>
      </div>

      <p className="result-count">
        {sessionCount} {sessionCount === 1 ? "session" : "sessions"}, {groups.count} page views
      </p>

      {groups.list.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted)" }}>Nothing matches these filters.</p>
      ) : (
        groups.list.map((g) => (
          <section key={g.key} className="act-day">
            <h3 className="act-day__title">{dayHeading(g.key, now)}</h3>
            {g.sessions.map((s) => {
              const isOpen = open.has(s.id);
              const name = names[s.staff];
              return (
                <div key={s.id} className="panel act-session">
                  <button type="button" className="act-session__head" aria-expanded={isOpen}
                    onClick={() => toggle(s.id)}>
                    <span className="act-avatar">{(name || s.staff).charAt(0).toUpperCase()}</span>
                    <span className="act-session__who">
                      <strong>{name || s.staff}</strong>
                      {name && <span className="mono act-faint"> {s.staff}</span>}
                      <span className="act-session__meta">
                        {clock(s.start)}–{clock(s.end)} · {durationText(s.end - s.start)} ·{" "}
                        {s.items.length} {s.items.length === 1 ? "page" : "pages"}
                      </span>
                    </span>
                    <span className="act-session__ago" title={exactTime(s.end)}>{ago(s.end, now)}</span>
                    <span className="act-caret" style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
                  </button>
                  {isOpen && (
                    <ol className="act-timeline">
                      {s.items.map((it, i) => {
                        const d = describePath(it.path);
                        return (
                          <li key={i} className="act-timeline__item">
                            <span className="mono act-timeline__time" title={exactTime(it.t)}>{clock(it.t)}</span>
                            <span className="act-timeline__icon"><Icon name={d.icon} size={15} /></span>
                            <span>
                              {d.type === "permits" && /^\/permits\/\d+$/.test(d.href) ? (
                                <Link href={d.href} style={{ color: "var(--color-brand-2)", fontWeight: 600 }}>{d.label}</Link>
                              ) : (
                                <span style={{ fontWeight: 600 }}>{d.label}</span>
                              )}
                              {d.label !== it.path && <span className="mono act-faint"> {it.path}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </>
  );
}
