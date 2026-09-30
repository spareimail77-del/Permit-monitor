import { buildCertificateRows } from "../../lib/certificates";

// Self-contained: all styling is inline and uses the app's theme variables
// (--color-*), so it follows dark/light mode without touching globals.css.

const s = {
  section: {
    marginTop: 20,
    paddingTop: 18,
    borderTop: "1px solid var(--color-rule)",
  },
  heading: {
    fontSize: "var(--font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-muted)",
    margin: "0 0 10px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  count: {
    fontSize: "var(--font-size-xs)",
    textTransform: "none",
    letterSpacing: 0,
    color: "var(--color-brand-2)",
    background: "var(--color-brand-tint)",
    borderRadius: 999,
    padding: "2px 10px",
  },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "6px 16px",
    padding: "12px 14px",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-rule)",
    borderRadius: 10,
  },
  name: {
    fontSize: "var(--font-size-base)",
    color: "var(--color-ink)",
    flex: "1 1 220px",
    minWidth: 0,
    wordBreak: "break-word",
  },
  noWrap: { display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 },
  noLabel: {
    fontSize: "var(--font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-faint)",
  },
  no: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-brand-2)",
    background: "var(--color-brand-tint)",
    borderRadius: 6,
    padding: "2px 10px",
    letterSpacing: "0.04em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px 28px",
  },
  sub: {
    fontSize: "var(--font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-muted)",
    margin: "0 0 6px",
  },
  plain: { listStyle: "none", margin: 0, padding: 0 },
  plainItem: {
    padding: "8px 0",
    borderBottom: "1px solid var(--color-rule)",
    color: "var(--color-ink)",
    wordBreak: "break-word",
  },
  note: {
    margin: "12px 0 0",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-expiring)",
  },
  empty: { margin: 0, color: "var(--color-ink-faint)" },
};

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function CertificateList({ certificates, certificateNo }) {
  const { names, numbers, paired, rows } = buildCertificateRows(
    certificates,
    certificateNo
  );

  return (
    <div style={s.section}>
      <div style={s.heading}>
        Certificates
        {paired && <span style={s.count}>{plural(rows.length, "certificate")}</span>}
      </div>

      {names.length === 0 && numbers.length === 0 && (
        <p style={s.empty}>No certificates on file</p>
      )}

      {paired && (
        <ul style={s.list}>
          {rows.map((r, i) => (
            <li key={i} style={s.row}>
              <span style={s.name}>{r.name}</span>
              <span style={s.noWrap}>
                <span style={s.noLabel}>Cert No.</span>
                <span className="mono" style={s.no}>{r.number}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!paired && (names.length > 0 || numbers.length > 0) && (
        <>
          <div style={s.grid}>
            <div>
              <div style={s.sub}>Associated Certificates</div>
              {names.length ? (
                <ul style={s.plain}>
                  {names.map((n, i) => (
                    <li key={i} style={s.plainItem}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p style={s.empty}>—</p>
              )}
            </div>
            <div>
              <div style={s.sub}>Certificate No.</div>
              {numbers.length ? (
                <ul style={s.plain}>
                  {numbers.map((n, i) => (
                    <li key={i} className="mono" style={s.plainItem}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p style={s.empty}>—</p>
              )}
            </div>
          </div>
          {names.length > 0 && numbers.length > 0 && (
            <p style={s.note}>
              {plural(names.length, "certificate")} but{" "}
              {plural(numbers.length, "number")} in the workbook, so they can't
              be matched up automatically. Check the Excel file.
            </p>
          )}
        </>
      )}
    </div>
  );
}
