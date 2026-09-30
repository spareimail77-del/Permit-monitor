import Link from "next/link";

// rows: [{ label, value, href? }] — horizontal bars scaled to the max value.
// A row with an href is a link (opens the permit list filtered to it).
export default function BreakdownBars({ rows }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;

  return (
    <div className="bar-list">
      {rows.map((r) => {
        const inner = (
          <>
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
          </>
        );
        return r.href ? (
          <Link prefetch={false} key={r.label} href={r.href} className="bar-row bar-row--link">
            {inner}
          </Link>
        ) : (
          <div key={r.label} className="bar-row">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
