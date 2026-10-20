"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDaysISO, isValidISODate } from "../../lib/permitRules";
import { todayOman } from "../../lib/omanDate";

// Our own date field: a typed box (dd-mm-yyyy) plus a calendar that matches the app.
//  - week starts on Sunday, Friday and Saturday are shaded (Oman weekend)
//  - min / max: days outside are greyed out and cannot be picked from the calendar
//  - rangeFrom + max: the allowed window is drawn as a band (used for "Valid to")
//  - shortcuts: [{ label, value }] buttons next to Today and Clear
//  - phone: the calendar opens as a bottom sheet
// value is an ISO date ("YYYY-MM-DD") or "". onChange gets an ISO date or "".

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MS = 86400000;

const toMs = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const dow = (iso) => new Date(toMs(iso)).getUTCDay();
const isWeekend = (iso) => dow(iso) === 5 || dow(iso) === 6;
const fmt = (iso) => (isValidISODate(iso) ? iso.split("-").reverse().join("-") : "");
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const monthLabel = (iso) => new Date(toMs(iso)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const longLabel = (iso) => new Date(toMs(iso)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Moves by whole months and keeps the day inside the new month (31 Jan + 1 month = 28/29 Feb).
function addMonths(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

// dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy or yyyy-mm-dd -> ISO, or "" when it is not a real date.
export function parseTyped(text) {
  const t = String(text || "").trim();
  let m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  let iso = "";
  if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) iso = t;
  return isValidISODate(iso) ? iso : "";
}

const Cal = ({ d }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const I = {
  cal: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
  prev: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  prevY: "M17 5l-7 7 7 7M11 5l-7 7 7 7",
  nextY: "M7 5l7 7-7 7M13 5l7 7-7 7",
};

export default function DatePicker({ id, value, onChange, min, max, rangeFrom, shortcuts = [], disabled, invalid, ariaLabel, placeholder = "dd-mm-yyyy" }) {
  const [text, setText] = useState(fmt(value));
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const [up, setUp] = useState(false);
  const [cursor, setCursor] = useState("");
  const [view, setView] = useState("");
  const inputRef = useRef(null);
  const popRef = useRef(null);
  const focusGrid = useRef(false);
  const today = useMemo(() => todayOman(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lo = isValidISODate(min) ? min : "";
  const hi = isValidISODate(max) ? max : "";
  const band = isValidISODate(rangeFrom) && hi ? rangeFrom : "";
  const allowed = (iso) => (!lo || iso >= lo) && (!hi || iso <= hi);

  // Keep the box in step when the value is changed from outside (for example "Use it").
  useEffect(() => {
    if (parseTyped(text) !== (value || "")) {
      setText(fmt(value));
      setBad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function openPicker() {
    if (disabled) return;
    const start = isValidISODate(value) ? value : band || (allowed(today) ? today : lo || today);
    setCursor(start);
    setView(monthStart(start));
    focusGrid.current = true;
    const r = inputRef.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom;
      setUp(below < 400 && r.top > below);
    }
    setOpen(true);
  }
  function close(refocus) {
    setOpen(false);
    if (refocus) inputRef.current?.focus();
  }
  function pick(iso) {
    if (!allowed(iso)) return;
    setText(fmt(iso));
    setBad(false);
    onChange(iso);
    close(true);
  }

  // Focus the day under the cursor after a keyboard move or when the calendar opens.
  useEffect(() => {
    if (!open || !focusGrid.current) return;
    focusGrid.current = false;
    popRef.current?.querySelector(`[data-iso="${cursor}"]`)?.focus();
  }, [open, cursor, view]);

  // Escape closes, a click elsewhere closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  function onType(e) {
    const t = e.target.value;
    setText(t);
    const iso = parseTyped(t);
    if (iso) {
      setBad(false);
      onChange(iso);
    }
  }
  function onBlur() {
    if (open) return;
    if (text.trim() === "") {
      setBad(false);
      if (value) onChange("");
      return;
    }
    const iso = parseTyped(text);
    if (!iso) {
      setBad(true);
      if (value) onChange("");
    } else {
      setBad(false);
      setText(fmt(iso));
    }
  }

  // ---- calendar grid ----
  const cells = useMemo(() => {
    if (!view) return [];
    const startISO = addDaysISO(view, -dow(view));
    return Array.from({ length: 42 }, (_, i) => addDaysISO(startISO, i));
  }, [view]);
  const rows = [0, 1, 2, 3, 4, 5].map((r) => cells.slice(r * 7, r * 7 + 7));
  const inView = (iso) => iso.slice(0, 7) === view.slice(0, 7);
  const tabIso = cells.includes(cursor) && inView(cursor) ? cursor : view;

  function move(iso) {
    setCursor(iso);
    setView(monthStart(iso));
    focusGrid.current = true;
  }
  function onGridKey(e) {
    const k = e.key;
    let next = null;
    if (k === "ArrowLeft") next = addDaysISO(cursor, -1);
    else if (k === "ArrowRight") next = addDaysISO(cursor, 1);
    else if (k === "ArrowUp") next = addDaysISO(cursor, -7);
    else if (k === "ArrowDown") next = addDaysISO(cursor, 7);
    else if (k === "Home") next = addDaysISO(cursor, -dow(cursor));
    else if (k === "End") next = addDaysISO(cursor, 6 - dow(cursor));
    else if (k === "PageUp") next = addMonths(cursor, e.shiftKey ? -12 : -1);
    else if (k === "PageDown") next = addMonths(cursor, e.shiftKey ? 12 : 1);
    if (next) {
      e.preventDefault();
      move(next);
    }
  }
  const shift = (n) => {
    setView(monthStart(addMonths(view, n)));
  };

  const todayOk = allowed(today);
  const clearable = Boolean(value);

  return (
    <div className="dp">
      <div className={`dp-box${invalid || bad ? " is-bad" : ""}${disabled ? " is-disabled" : ""}`}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="dp-input"
          placeholder={placeholder}
          maxLength={10}
          value={text}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={invalid || bad ? true : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          onChange={onType}
          onBlur={onBlur}
          onClick={() => !open && openPicker()}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openPicker();
            }
          }}
        />
        <button type="button" className="dp-open" aria-label="Open calendar" disabled={disabled} onClick={() => (open ? close(false) : openPicker())}>
          <Cal d={I.cal} />
        </button>
      </div>
      {bad && <p className="pform-error">Type the date as dd-mm-yyyy, for example 31-10-2026.</p>}

      {open && (
        <>
          <div className="dp-backdrop" onMouseDown={() => close(false)} aria-hidden="true" />
          <div className={`dp-pop${up ? " dp-pop--up" : ""}`} role="dialog" aria-modal="true" aria-label={ariaLabel ? `${ariaLabel}: choose a date` : "Choose a date"} ref={popRef}>
            <span className="dp-grab" aria-hidden="true" />
            <div className="dp-head">
              <div className="dp-nav">
                <button type="button" className="dp-nbtn" onClick={() => shift(-12)} aria-label="Previous year">
                  <Cal d={I.prevY} />
                </button>
                <button type="button" className="dp-nbtn" onClick={() => shift(-1)} aria-label="Previous month">
                  <Cal d={I.prev} />
                </button>
              </div>
              <div className="dp-title" aria-live="polite">
                {monthLabel(view)}
              </div>
              <div className="dp-nav">
                <button type="button" className="dp-nbtn" onClick={() => shift(1)} aria-label="Next month">
                  <Cal d={I.next} />
                </button>
                <button type="button" className="dp-nbtn" onClick={() => shift(12)} aria-label="Next year">
                  <Cal d={I.nextY} />
                </button>
              </div>
            </div>

            <table className="dp-grid" role="grid" aria-label={monthLabel(view)} onKeyDown={onGridKey}>
              <thead>
                <tr>
                  {WEEKDAYS.map((w, i) => (
                    <th key={w} scope="col" className={i >= 5 ? "is-we" : ""} abbr={w}>
                      {w.slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((iso) => {
                      const off = !allowed(iso);
                      const cls = [
                        "dp-day",
                        !inView(iso) && "is-out",
                        isWeekend(iso) && "is-we",
                        iso === today && "is-today",
                        off && "is-off",
                        band && iso >= band && iso <= hi && "in-band",
                        band && iso === band && "band-start",
                        band && iso === hi && "band-end",
                        iso === value && "is-sel",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <td key={iso} role="gridcell" aria-selected={iso === value}>
                          <button
                            type="button"
                            className={cls}
                            data-iso={iso}
                            tabIndex={iso === tabIso ? 0 : -1}
                            aria-disabled={off || undefined}
                            aria-current={iso === today ? "date" : undefined}
                            aria-label={`${longLabel(iso)}${off ? ", not allowed" : ""}`}
                            title={off ? (lo && iso < lo ? "Before Valid from" : "After the latest allowed date") : undefined}
                            onClick={() => pick(iso)}
                            onFocus={() => setCursor(iso)}
                          >
                            {Number(iso.slice(8, 10))}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {band && (
              <p className="dp-legend">
                <span className="dp-legend__sw" aria-hidden="true" /> Allowed dates: {fmt(band)} to {fmt(hi)}
              </p>
            )}

            <div className="dp-foot">
              <button type="button" className="dp-link" disabled={!todayOk} onClick={() => pick(today)}>
                Today
              </button>
              {shortcuts.map((s) => (
                <button key={s.label} type="button" className="dp-link dp-link--green" disabled={!allowed(s.value)} onClick={() => pick(s.value)}>
                  {s.label}
                </button>
              ))}
              <span className="dp-foot__gap" />
              {clearable && (
                <button
                  type="button"
                  className="dp-link dp-link--danger"
                  onClick={() => {
                    setText("");
                    setBad(false);
                    onChange("");
                    close(true);
                  }}
                >
                  Clear
                </button>
              )}
              <button type="button" className="dp-link dp-close" onClick={() => close(true)}>
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
