// rows: [{ label, value }] — rendered as horizontal bars scaled to the max value.
export default function BreakdownBars({ rows }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;

  return (
    <div className="bar-list">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="bar-row__top">
            <span className="bar-row__label">{r.label}</span>
            <span className="bar-row__value">{r.value}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.max(6, (r.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
