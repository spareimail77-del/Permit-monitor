// Lists what an upload changed: permits added, updated (with the fields that
// changed) and removed. Plain markup, used by the upload result and by the
// upload history.

function Group({ title, color, count, more, children }) {
  if (!count) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 600, color }}>
        {title} ({count})
      </p>
      {children}
      {more > 0 && <p style={styles.more}>…and {more} more not listed here.</p>}
    </div>
  );
}

export default function ChangeDetails({ counts, changes }) {
  const c = changes || {};
  const more = c.more || {};
  return (
    <div style={{ fontSize: "var(--font-size-sm)" }}>
      <Group title="Added" color="var(--color-open)" count={counts.added} more={more.added}>
        <p className="mono" style={styles.refs}>{(c.added || []).join(", ")}</p>
      </Group>

      <Group title="Updated" color="var(--color-brand-2)" count={counts.updated} more={more.updated}>
        <div style={{ display: "grid", gap: 4 }}>
          {(c.updated || []).map((u) => (
            <p key={u.ref} style={styles.line}>
              <span className="mono" style={{ fontWeight: 600 }}>{u.ref}</span>{" "}
              {u.f.map(([label, from, to], i) => (
                <span key={label}>
                  {i > 0 && " · "}
                  {label}: <span style={styles.old}>{from || "(empty)"}</span> → {to || "(empty)"}
                </span>
              ))}
            </p>
          ))}
        </div>
      </Group>

      <Group title="Removed" color="var(--color-expired)" count={counts.removed} more={more.removed}>
        <p className="mono" style={styles.refs}>{(c.removed || []).join(", ")}</p>
      </Group>
    </div>
  );
}

const styles = {
  refs: { margin: 0, overflowWrap: "anywhere", lineHeight: 1.6 },
  line: { margin: 0, overflowWrap: "anywhere", lineHeight: 1.5 },
  old: { color: "var(--color-ink-muted)", textDecoration: "line-through" },
  more: { margin: "4px 0 0", color: "var(--color-ink-muted)", fontSize: "var(--font-size-xs)" },
};
