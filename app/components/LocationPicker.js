"use client";

import { useMemo, useRef, useState } from "react";
import { locKey, matchScore, suggest } from "../../lib/locationMatch";
import { MAX_LOCATIONS } from "../../lib/locationLimits";

// The Location field of the permit form. The person TYPES, matching locations appear as
// chips, and they CLICK a chip. Only listed locations can be chosen (the server checks too).
// Several can be chosen; they are saved as "A & B" or "A, B & C".
// Matching runs in the browser only (lib/locationMatch.js): typing makes no requests.
// Root also gets an "Add" chip for a place that is not in the list yet.

const SHOWN = 24;

export default function LocationPicker({ id, value, onChange, options, canAdd, onAdded, disabled, invalid }) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState("");
  const inputRef = useRef(null);

  const all = useMemo(() => suggest(text, options, value, 1000), [text, options, value]);
  const left = Math.max(0, MAX_LOCATIONS - value.length);
  const full = left === 0;
  const typed = text.trim().replace(/\s+/g, " ").toUpperCase();
  // Nothing is offered until the person starts typing (a long list of tags would only be clutter).
  const chips = typed ? all.slice(0, SHOWN) : [];
  // Root can add what was typed when it is not (a spelling of) a place already in the list.
  const canAddTyped = canAdd && typed && value.length < MAX_LOCATIONS && !options.some((o) => locKey(o) === locKey(typed));

  function choose(loc) {
    if (disabled || full) return;
    if (value.some((v) => locKey(v) === locKey(loc))) return; // never twice
    onChange([...value, loc]);
    setText("");
    setProblem("");
    inputRef.current?.focus();
  }
  function remove(index) {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  // Everything that clearly STARTS WITH / CONTAINS what was typed (so "APS-30" takes
  // APS-30/1..4). Spelling-mistake guesses are left out on purpose: they could be wrong.
  const exact = typed ? all.filter((l) => matchScore(typed, l) >= 600) : [];
  const canAll = !full && exact.length > 1;
  function addAll() {
    if (disabled || !canAll || exact.length > left) return;
    onChange([...value, ...exact]);
    setText("");
    setProblem("");
    inputRef.current?.focus();
  }
  function clearAll() {
    if (disabled) return;
    onChange([]);
    setText("");
    inputRef.current?.focus();
  }

  async function addTyped() {
    if (!canAddTyped || adding || full) return;
    setAdding(true);
    setProblem("");
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list: "location", value: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(data.error || "Could not add it.");
      } else {
        onAdded(data.value || typed);
        choose(data.value || typed);
      }
    } catch {
      setProblem("Network error. Try again.");
    }
    setAdding(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault(); // Enter must not save the whole form
      if (typed && chips[0] && !full) choose(chips[0]);
    } else if (e.key === "Backspace" && !text && value.length) {
      remove(value.length - 1);
    } else if (e.key === "Escape") {
      setText("");
    }
  }

  const empty = options.length === 0;

  return (
    <div className={`lp${invalid ? " is-invalid" : ""}`}>
      <div className="lp-box" onClick={() => inputRef.current?.focus()}>
        {value.map((loc, i) => (
          <span key={loc} className="lp-tag">
            {loc}
            <button type="button" className="lp-tag__x" onClick={() => remove(i)} disabled={disabled} aria-label={`Remove ${loc}`}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          className="lp-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setProblem("");
          }}
          onKeyDown={onKeyDown}
          disabled={disabled || full}
          maxLength={80}
          autoComplete="off"
          placeholder={full ? `Maximum of ${MAX_LOCATIONS} reached` : value.length ? "Add another location…" : "Start typing a location, e.g. MPS"}
          aria-label="Type to find a location"
        />
      </div>

      {(value.length > 0 || full) && (
        <p className={`pform-hint lp-count${left <= 3 ? " is-near" : ""}`} aria-live="polite">
          {value.length} of {MAX_LOCATIONS} locations{full ? " (maximum reached; remove one to add another)" : left <= 3 ? ` (${left} left)` : ""}
          {value.length > 1 && (
            <>
              {" · "}
              <button type="button" className="pform-link" onClick={clearAll} disabled={disabled}>
                Clear all
              </button>
            </>
          )}
        </p>
      )}

      {!full && (chips.length > 0 || canAddTyped) && (
      <div className="lp-chips" role="group" aria-label="Matching locations">
        {canAll && (
          <button
            type="button"
            className="lp-chip lp-chip--all"
            onClick={addAll}
            disabled={disabled || exact.length > left}
            title={exact.length > left ? `Only ${left} more can be added` : exact.join(", ")}
          >
            {exact.length > left ? `${exact.length} match (only ${left} slots left)` : `+ Add all ${exact.length} matching`}
          </button>
        )}
        {chips.map((loc, i) => (
          <button key={loc} type="button" className={`lp-chip${typed && i === 0 ? " is-top" : ""}`} onClick={() => choose(loc)} disabled={disabled}>
            {loc}
          </button>
        ))}
        {canAddTyped && (
          <button type="button" className="lp-chip lp-chip--add" onClick={addTyped} disabled={disabled || adding} title="Adds this place to the Location list for everyone">
            {adding ? "Adding…" : `+ Add “${typed}” to the list`}
          </button>
        )}
      </div>
      )}

      {!full && typed && all.length > SHOWN && <p className="pform-hint">{all.length - SHOWN} more: keep typing to narrow them down.</p>}
      {!full && !chips.length && !canAddTyped && typed && (
        <p className="pform-hint">{empty ? "No locations have been set up yet." : "No match. Check the spelling, or ask Root to add this location."}</p>
      )}
      {!typed && empty && canAdd && <p className="pform-hint">The list is empty. Type the first location, then click “Add”.</p>}
      {!typed && empty && !canAdd && <p className="pform-error">No locations have been set up yet. Ask Root to add them.</p>}
      {!full && typed && chips.length > 0 && <p className="pform-hint">Press Enter to pick the first one.</p>}
      {problem && <p className="pform-error">{problem}</p>}
    </div>
  );
}
