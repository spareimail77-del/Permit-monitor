"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Defined outside ListsAdmin so the "add" box keeps focus while typing.
function ListCard({ list, items, busy, onAdd, onToggle }) {
  const [text, setText] = useState("");
  return (
    <div className="panel pform-card">
      <h3 className="pform-title">{list.label}</h3>
      {items.length === 0 ? (
        <p className="pform-hint">No values yet.</p>
      ) : (
        <ul className="file-list" style={{ marginBottom: 12 }}>
          {items.map((it) => (
            <li key={it.id} style={it.active ? undefined : { opacity: 0.6 }}>
              <span>
                {it.value} {!it.active && <span className="badge">hidden</span>}
              </span>
              <button type="button" className="pform-link" disabled={busy} onClick={() => onToggle(it)}>
                {it.active ? "Hide" : "Show"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="pform-actions"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onAdd(list.key, text)) setText("");
        }}
      >
        <input className="pform-input" style={{ flex: "1 1 200px", width: "auto" }} placeholder="Add a value" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} disabled={busy} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

export default function ListsAdmin({ lists, values }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });

  async function send(url, method, body) {
    if (busy) return false;
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "That did not work.", error: true });
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setMessage({ text: "Network error. Try again.", error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {message.text && <div className={message.error ? "notice notice--danger" : "notice notice--ok"}>{message.text}</div>}
      <div className="pform">
        {lists.map((l) => (
          <ListCard
            key={l.key}
            list={l}
            items={values[l.key] || []}
            busy={busy}
            onAdd={(list, value) => send("/api/lists", "POST", { list, value })}
            onToggle={(it) => send(`/api/lists/${it.id}`, "PATCH", { active: !it.active })}
          />
        ))}
      </div>
    </>
  );
}
