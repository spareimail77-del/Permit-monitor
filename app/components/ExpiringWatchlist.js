import Link from "next/link";
import Icon from "./Icon";

export default function ExpiringWatchlist({ permits }) {
  if (permits.length === 0) {
    return (
      <div className="watchlist-empty">
        <Icon name="checkCircle" size={16} style={{ color: "var(--color-open)" }} />
        Nothing expiring in the next 3 days.
      </div>
    );
  }

  return (
    <div className="watchlist">
      {permits.map((p) => (
        <Link key={p.rowNumber} href={`/permits/${p.rowNumber}`} className="watchlist-row">
          <div style={{ minWidth: 0 }}>
            <div className="watchlist-row__ref">{p.reference}</div>
            <div className="watchlist-row__meta">
              {p.area} · {p.location || "No location"}
            </div>
          </div>
          <span
            className="watchlist-row__days"
            style={{
              background: "var(--color-expiring-tint)",
              color: "var(--color-expiring)",
            }}
          >
            {p.daysRemaining === 0 ? "Due today" : `${p.daysRemaining}d left`}
          </span>
        </Link>
      ))}
    </div>
  );
}
