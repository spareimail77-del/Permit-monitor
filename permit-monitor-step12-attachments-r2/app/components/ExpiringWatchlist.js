import Link from "next/link";
import Icon from "./Icon";
import { STATUS_META } from "../../lib/statusMeta";

export default function ExpiringWatchlist({ permits }) {
  if (permits.length === 0) {
    return (
      <div className="watchlist-empty">
        <Icon name="checkCircle" size={16} style={{ color: "var(--color-open)" }} />
        No open permits with a Valid To date on record.
      </div>
    );
  }

  return (
    <div className="watchlist watchlist-scroll">
      {permits.map((p) => {
        const meta = STATUS_META[p.displayStatus] || STATUS_META.OPEN;
        return (
          <Link key={p.rowNumber} href={`/permits/${p.rowNumber}`} className="watchlist-row">
            <div style={{ minWidth: 0 }}>
              <div className="watchlist-row__ref">{p.reference}</div>
              <div className="watchlist-row__meta">
                {p.area} · {p.location || "No location"}
              </div>
            </div>
            <span
              className="watchlist-row__days"
              style={{ background: meta.tint, color: meta.color }}
            >
              {p.daysRemaining === 0
                ? "Due today"
                : p.daysRemaining < 0
                ? `${Math.abs(p.daysRemaining)}d overdue`
                : `${p.daysRemaining}d left`}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
