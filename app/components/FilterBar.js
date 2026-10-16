"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const KEYS = ["q", "status", "area", "type", "applicant", "holder", "month", "files"];
const EMPTY = { q: "", status: "", area: "", type: "", applicant: "", holder: "", month: "", files: "" };
const FILES_TEXT = { has: "Has files", none: "No files" };
// `sort` and `dir` (column sorting) are not filters: they are kept as they are.
const toQuery = (v, sort, dir) => {
  const p = new URLSearchParams();
  for (const k of KEYS) if (v[k]) p.set(k, v[k]);
  if (sort) {
    p.set("sort", sort);
    if (dir === "desc") p.set("dir", "desc");
  }
  return p.toString();
};

// The filter bar of the permit list. Choosing a status, area or type applies at once;
// typing in the search box applies after a short pause. Every active filter shows as a
// chip that can be removed with one click. Without JavaScript the Apply button still
// works, because this is a normal GET form.
export default function FilterBar({ initial, statusOptions, areas, types, months = [], sort = "", dir = "", showFiles = true }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const last = useRef(toQuery(initial, sort, dir));
  const timer = useRef(null);
  const key = toQuery(initial, sort, dir);

  // The address changed from outside (a dashboard link, the back button): follow it.
  useEffect(() => {
    if (key !== last.current) {
      last.current = key;
      setV(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(next) {
    clearTimeout(timer.current);
    const qs = toQuery(next, sort, dir);
    last.current = qs;
    start(() => router.push(qs ? `/permits?${qs}` : "/permits"));
  }

  function change(name, value, delay = 0) {
    const next = { ...v, [name]: value };
    setV(next);
    clearTimeout(timer.current);
    if (delay) timer.current = setTimeout(() => go(next), delay);
    else go(next);
  }

  const statusText = (statusOptions.find((s) => s.value === v.status) || {}).label || v.status;
  // Months that have permits, newest first. A month typed into the address that has
  // none is still listed, so the select never shows a wrong value.
  const monthList = v.month && !months.some((m) => m.value === v.month) ? [{ value: v.month, label: v.month, count: 0 }, ...months] : months;
  const mIdx = monthList.findIndex((m) => m.value === v.month);
  const earlier = mIdx + 1 < monthList.length ? monthList[mIdx + 1] : null; // also works from "All months" (mIdx = -1)
  const later = mIdx > 0 ? monthList[mIdx - 1] : null;
  const monthText = (monthList.find((m) => m.value === v.month) || {}).label || v.month;

  const chips = [
    v.q && { name: "q", text: `Search: “${v.q}”` },
    v.status && { name: "status", text: `Status: ${statusText}` },
    v.area && { name: "area", text: `Area: ${v.area}` },
    v.type && { name: "type", text: `Type: ${v.type}` },
    v.applicant && { name: "applicant", text: `Applicant: ${v.applicant}` },
    v.holder && { name: "holder", text: `Holder: ${v.holder}` },
    v.month && { name: "month", text: `Month: ${monthText}` },
    v.files && { name: "files", text: `Files: ${FILES_TEXT[v.files]}` },
  ].filter(Boolean);

  return (
    <div className="filters" data-pending={pending ? "true" : undefined}>
      <form
        method="get"
        action="/permits"
        className="panel filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          go(v);
        }}
      >
        <label className="search-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            name="q"
            className="pform-input"
            value={v.q}
            onChange={(e) => change("q", e.target.value, 400)}
            placeholder="Search number, location, applicant, holder"
            aria-label="Search"
            autoComplete="off"
          />
        </label>
        <select name="status" className="pform-input" value={v.status} onChange={(e) => change("status", e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="area" className="pform-input" value={v.area} onChange={(e) => change("area", e.target.value)} aria-label="Area">
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select name="type" className="pform-input" value={v.type} onChange={(e) => change("type", e.target.value)} aria-label="Type of permit">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="month-ctl" role="group" aria-label="Month of the From date">
          <button type="button" className="month-btn" disabled={!earlier} onClick={() => earlier && change("month", earlier.value)} aria-label="Earlier month" title={earlier ? earlier.label : "No earlier month"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <select name="month" className="pform-input" value={v.month} onChange={(e) => change("month", e.target.value)} aria-label="Month of the From date">
            <option value="">All months</option>
            {monthList.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} ({m.count})
              </option>
            ))}
          </select>
          <button type="button" className="month-btn" disabled={!later} onClick={() => later && change("month", later.value)} aria-label="Later month" title={later ? later.label : "No later month"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        {showFiles && (
          <select name="files" className="pform-input" value={v.files} onChange={(e) => change("files", e.target.value)} aria-label="Attachments">
            <option value="">Files: any</option>
            <option value="has">Has files</option>
            <option value="none">No files</option>
          </select>
        )}
        {v.applicant && <input type="hidden" name="applicant" value={v.applicant} />}
        {v.holder && <input type="hidden" name="holder" value={v.holder} />}
        <button type="submit" className="btn btn-primary btn-sm filter-apply">
          Apply
        </button>
      </form>

      {chips.length > 0 && (
        <ul className="chips" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.name}>
              <button type="button" className="chip" onClick={() => change(c.name, "")} aria-label={`Remove filter ${c.text}`}>
                {c.text}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="chip-clear" onClick={() => { setV(EMPTY); go(EMPTY); }}>
              Clear all
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
