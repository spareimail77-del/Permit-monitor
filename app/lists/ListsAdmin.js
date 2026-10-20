"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Dropdown lists: pick a list on the left, edit its values on the right.
// Values are shown most used first (the permit form uses the same order).
// A value is never deleted, only hidden; hiding can be undone straight away.

const Svg = ({ d, size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON = {
  hide: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.6 9.6 0 0 1 12 5c5 0 8.5 4.2 9.5 7a11 11 0 0 1-2.5 3.7M6.6 6.6A11 11 0 0 0 2.5 12c1 2.8 4.5 7 9.5 7a9.4 9.4 0 0 0 4-.9",
  show: "M2.5 12c1-2.8 4.5-7 9.5-7s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

export default function ListsAdmin({ lists, values }) {
  const router = useRouter();
  const [current, setCurrent] = useState(lists[0].key);
  const [text, setText] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null); // { text, error, undo }
  const [ov, setOv] = useState({}); // instant (not yet confirmed) active flags by id
  const toastTimer = useRef(null);
  const tabRefs = useRef({});

  // New data from the server replaces the instant flags.
  useEffect(() => setOv({}), [values]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function say(next, ms = 6000) {
    clearTimeout(toastTimer.current);
    setToast(next);
    if (next && ms) toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  async function call(url, method, body) {
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "That did not work." };
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error. Try again." };
    }
  }

  const listItems = (key) =>
    (values[key] || []).map((it) => (it.id in ov ? { ...it, active: ov[it.id] } : it)).sort((a, b) => b.used - a.used || a.value.localeCompare(b.value));

  const items = useMemo(() => listItems(current), [current, values, ov]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.filter((i) => i.active);
  const hidden = items.filter((i) => !i.active);
  const maxUsed = Math.max(1, ...shown.map((i) => i.used));
  const meta = lists.find((l) => l.key === current);

  async function setActive(it, active, { withUndo } = {}) {
    if (pendingId) return;
    setPendingId(it.id);
    setOv((o) => ({ ...o, [it.id]: active }));
    const r = await call(`/api/lists/${it.id}`, "PATCH", { active });
    setPendingId(null);
    if (!r.ok) {
      setOv((o) => {
        const n = { ...o };
        delete n[it.id];
        return n;
      });
      say({ text: r.error, error: true });
      return;
    }
    router.refresh();
    if (withUndo) say({ text: `${it.value} hidden from the dropdown.`, undo: () => setActive(it, true) });
    else say({ text: `${it.value} is shown in the dropdown again.` }, 3500);
  }

  // What the typed value will be, and whether it already exists.
  const typed = text.trim().replace(/\s+/g, " ").toUpperCase();
  const existing = typed ? items.find((i) => i.value.toUpperCase() === typed) : null;

  async function add(e) {
    e.preventDefault();
    if (!typed || adding) return;
    if (existing) return;
    setAdding(true);
    const r = await call("/api/lists", "POST", { list: current, value: typed });
    setAdding(false);
    if (!r.ok) return say({ text: r.error, error: true });
    setText("");
    router.refresh();
    say({ text: `${typed} added to ${meta.label}.` }, 3500);
  }

  function onTabKey(e, index) {
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = lists[(index + dir + lists.length) % lists.length].key;
    setCurrent(next);
    setText("");
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="ls">
      <nav className="ls-rail" aria-label="Dropdown lists">
        <div className="ls-tabs" role="tablist" aria-orientation="vertical">
          {lists.map((l, i) => {
            const all = listItems(l.key);
            const on = all.filter((x) => x.active).length;
            return (
              <button
                key={l.key}
                ref={(el) => (tabRefs.current[l.key] = el)}
                id={`ls-tab-${l.key}`}
                type="button"
                role="tab"
                aria-selected={current === l.key}
                aria-controls="ls-panel"
                tabIndex={current === l.key ? 0 : -1}
                className={`ls-tab${current === l.key ? " is-on" : ""}`}
                onClick={() => {
                  setCurrent(l.key);
                  setText("");
                }}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                <span className="ls-tab__name">{l.label}</span>
                <span className="ls-tab__n">{on}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="panel ls-panel" id="ls-panel" role="tabpanel" aria-labelledby={`ls-tab-${current}`}>
        <header className="ls-head">
          <div>
            <h2 className="ls-title">{meta.label}</h2>
            <p className="ls-sub">
              {shown.length} shown{hidden.length > 0 ? ` · ${hidden.length} hidden` : ""} · most used first
            </p>
          </div>
        </header>

        <form className="ls-add" onSubmit={add}>
          <div className="ls-add__field">
            <input
              className="pform-input"
              placeholder={`Add to ${meta.label}…`}
              aria-label={`Add a value to ${meta.label}`}
              value={text}
              maxLength={80}
              disabled={adding}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={adding || !typed || Boolean(existing)}>
              <Svg d={ICON.plus} /> {adding ? "Adding…" : "Add"}
            </button>
          </div>
          <p className="ls-add__hint" aria-live="polite">
            {existing ? (
              existing.active ? (
                <span className="is-warn">{existing.value} is already in this list.</span>
              ) : (
                <span className="is-warn">
                  {existing.value} is already here, but hidden.{" "}
                  <button type="button" className="pform-link" onClick={() => { setText(""); setActive(existing, true); }}>
                    Show it again
                  </button>
                </span>
              )
            ) : typed ? (
              <>
                Will be saved as <strong className="mono">{typed}</strong>
              </>
            ) : (
              "Values are saved in UPPER CASE."
            )}
          </p>
        </form>

        {shown.length === 0 ? (
          <p className="ls-empty">No values yet. Add the first one above.</p>
        ) : (
          <ul className="ls-chips" aria-label={`${meta.label}: shown in the dropdown`}>
            {shown.map((it) => (
              <li key={it.id} className={`ls-chip${pendingId === it.id ? " is-busy" : ""}`}>
                <span className="ls-chip__main">
                  <span className="ls-chip__name">{it.value}</span>
                  <span className="ls-chip__use" title={it.used ? `Used by ${it.used} permit${it.used === 1 ? "" : "s"}` : "Not used by any permit yet"}>
                    {it.used ? it.used : "unused"}
                  </span>
                </span>
                <span className="ls-chip__bar" aria-hidden="true">
                  <span style={{ width: `${(it.used / maxUsed) * 100}%` }} />
                </span>
                <button
                  type="button"
                  className="ls-chip__btn"
                  disabled={Boolean(pendingId)}
                  onClick={() => setActive(it, false, { withUndo: true })}
                  aria-label={`Hide ${it.value} from the dropdown`}
                  title="Hide from the dropdown"
                >
                  <Svg d={ICON.hide} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {hidden.length > 0 && (
          <div className="ls-hidden">
            <h3 className="ls-hidden__title">Hidden</h3>
            <p className="ls-hidden__sub">Not offered in the dropdown. Old permits keep them.</p>
            <ul className="ls-chips" aria-label={`${meta.label}: hidden`}>
              {hidden.map((it) => (
                <li key={it.id} className={`ls-chip ls-chip--hidden${pendingId === it.id ? " is-busy" : ""}`}>
                  <span className="ls-chip__main">
                    <span className="ls-chip__name">{it.value}</span>
                    {it.used > 0 && <span className="ls-chip__use">{it.used}</span>}
                  </span>
                  <button type="button" className="ls-chip__btn ls-chip__btn--show" disabled={Boolean(pendingId)} onClick={() => setActive(it, true)} aria-label={`Show ${it.value} in the dropdown again`}>
                    <Svg d={ICON.show} /> Show
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {toast && (
        <div className={`ls-toast${toast.error ? " is-error" : ""}`} role={toast.error ? "alert" : "status"}>
          {!toast.error && <Svg d={ICON.check} />}
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              className="ls-toast__undo"
              onClick={() => {
                const u = toast.undo;
                setToast(null);
                u();
              }}
            >
              Undo
            </button>
          )}
          <button type="button" className="ls-toast__x" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
