"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STATE_TEXT = {
  not_opened: "Not opened",
  active: "Active",
  ended: "Ended",
  never_opened: "Expired, never opened",
  revoked: "Cancelled",
};

function when(row) {
  if (row.state === "not_opened") return `Can be opened until ${row.validUntil}`;
  if (row.state === "active") return `Opened ${row.opened}. Ends ${row.expires} (${row.minutesLeft} min left)`;
  if (row.state === "ended") return `Opened ${row.opened}. Ended ${row.expires}`;
  if (row.state === "never_opened") return `Was valid until ${row.validUntil}`;
  return row.opened ? `Opened ${row.opened}. Cancelled` : "Cancelled before it was opened";
}

// Root: create guest links, see whether each was opened and when it ends, cancel or remove.
export default function GuestLinksManager({ rows, sessionChoices, linkChoices }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [linkHours, setLinkHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { url, label }
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const urlRef = useRef(null);

  // The status keeps itself up to date while this page is open (a small read every 20 seconds).
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => clearInterval(t);
  }, [router]);

  async function create(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/admin/guest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, sessionMinutes, linkHours }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create the link.");
      } else {
        setCreated({ url: data.url, label: label.trim() });
        setLabel("");
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      urlRef.current?.select();
    }
  }

  async function act(row, method, body) {
    const text =
      method === "DELETE"
        ? `Remove "${row.label}" from the list?`
        : row.state === "active"
          ? `Cancel "${row.label}"? The guest is signed out immediately.`
          : `Cancel "${row.label}"? The link will stop working.`;
    if (!window.confirm(text)) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/guest-links/${row.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "That did not work.");
      else router.refresh();
    } catch {
      setError("Network error. Try again.");
    }
    setBusyId(null);
  }

  return (
    <div className="gl">
      <section className="panel gl-create">
        <h2 className="gl-h">New guest link</h2>
        <form className="gl-form" onSubmit={create}>
          <div className="pform-field gl-form__wide">
            <label htmlFor="gl-label">Name (only you see it)</label>
            <input id="gl-label" className="pform-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="For example: Plant manager visit" disabled={busy} />
          </div>
          <div className="pform-field">
            <label htmlFor="gl-session">Guest can look around for</label>
            <select id="gl-session" className="pform-input" value={sessionMinutes} onChange={(e) => setSessionMinutes(Number(e.target.value))} disabled={busy}>
              {sessionChoices.map((c) => (
                <option key={c.minutes} value={c.minutes}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="pform-hint">The time starts when they press Start.</span>
          </div>
          <div className="pform-field">
            <label htmlFor="gl-link">Link can be opened within</label>
            <select id="gl-link" className="pform-input" value={linkHours} onChange={(e) => setLinkHours(Number(e.target.value))} disabled={busy}>
              {linkChoices.map((c) => (
                <option key={c.hours} value={c.hours}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="pform-hint">After this, an unopened link stops working.</span>
          </div>
          <div className="gl-form__go">
            <button type="submit" className="btn btn-primary" disabled={busy || !label.trim()}>
              {busy ? "Creating…" : "Create link"}
            </button>
          </div>
        </form>
        {error && <p className="error-text" role="alert">{error}</p>}

        {created && (
          <div className="gl-new" role="status">
            <p className="gl-new__title">
              Link for <strong>{created.label}</strong>. Copy it now: it is shown only this once.
            </p>
            <div className="gl-new__row">
              <input ref={urlRef} className="pform-input mono" readOnly value={created.url} onFocus={(e) => e.target.select()} aria-label="Guest link" />
              <button type="button" className="btn btn-primary" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="pform-hint">It works once, in any browser. Send it only to the person it is for.</p>
          </div>
        )}
      </section>

      <section className="panel gl-list">
        <div className="gl-list__head">
          <h2 className="gl-h">Links</h2>
          <button type="button" className="btn btn-sm" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="pd-none">No guest links yet.</p>
        ) : (
          <ul className="gl-rows">
            {rows.map((r) => (
              <li key={r.id} className="gl-row">
                <div className="gl-row__main">
                  <div className="gl-row__top">
                    <strong className="gl-row__label">{r.label}</strong>
                    <span className={`gl-state gl-state--${r.state}`}>{STATE_TEXT[r.state]}</span>
                  </div>
                  <div className="gl-row__when">{when(r)}</div>
                  <div className="pform-hint">
                    {r.sessionMinutes >= 60 ? `${r.sessionMinutes / 60} h` : `${r.sessionMinutes} min`} view · created {r.created}
                    {r.createdBy ? ` by ${r.createdBy}` : ""}
                  </div>
                </div>
                <div className="gl-row__actions">
                  {(r.state === "not_opened" || r.state === "active") && (
                    <button type="button" className="btn btn-sm" disabled={busyId === r.id} onClick={() => act(r, "PATCH", { action: "revoke" })}>
                      {r.state === "active" ? "End now" : "Cancel link"}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm" disabled={busyId === r.id} onClick={() => act(r, "DELETE")}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
