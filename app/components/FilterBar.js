"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const KEYS = ["q", "status", "area", "type", "applicant", "holder"];
const EMPTY = { q: "", status: "", area: "", type: "", applicant: "", holder: "" };
const toQuery = (v) => {
  const p = new URLSearchParams();
  for (const k of KEYS) if (v[k]) p.set(k, v[k]);
  return p.toString();
};

// The filter bar of the permit list. Choosing a status, area or type applies at once;
// typing in the search box applies after a short pause. Every active filter shows as a
// chip that can be removed with one click. Without JavaScript the Apply button still
// works, because this is a normal GET form.
export default function FilterBar({ initial, statusOptions, areas, types }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const last = useRef(toQuery(initial));
  const timer = useRef(null);
  const key = toQuery(initial);

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
    const qs = toQuery(next);
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
  const chips = [
    v.q && { name: "q", text: `Search: “${v.q}”` },
    v.status && { name: "status", text: `Status: ${statusText}` },
    v.area && { name: "area", text: `Area: ${v.area}` },
    v.type && { name: "type", text: `Type: ${v.type}` },
    v.applicant && { name: "applicant", text: `Applicant: ${v.applicant}` },
    v.holder && { name: "holder", text: `Holder: ${v.holder}` },
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
