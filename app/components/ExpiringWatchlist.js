import Link from "next/link";
import Icon from "./Icon";
import { STATUS_META } from "../../lib/statusMeta";

// permits: open permits with a numeric daysRemaining, soonest first.
// Grouped by expiry day so a long run of identical "1d left" badges
// becomes "Tomorrow · Wed 30 Sep — 17 permits".

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC", // validTo is a plain calendar date; no timezone shift
});

function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DAY_FORMAT.format(d);
}

function groupLabel(days) {
  if (days < 0) return "Past Valid To (still marked open)";
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export default function ExpiringWatchlist({ permits, totalCount, viewAllHref }) {
  if (permits.length === 0) {
    return (
      <div className="watchlist-empty">
        <Icon name="checkCircle" size={16} style={{ color: "var(--color-open)" }} />
        No open permits with a Valid To date on record.
      </div>
    );
  }

  const groups = [];
  for (const p of permits) {
    const last = groups[groups.length - 1];
    if (last && last.validTo === p.validTo && last.days === p.daysRemaining) {
      last.items.push(p);
    } else {
      groups.push({ validTo: p.validTo, days: p.daysRemaining, items: [p] });
    }
  }

  return (
    <>
      <div className="watchlist watchlist-scroll">
        {groups.map((g) => (
          <section key={`${g.validTo}-${g.days}`} className="watchlist-group">
            <h3 className="watchlist-group__head">
              <span>
                {groupLabel(g.days)}
                {g.validTo && <span className="watchlist-group__date"> · {formatDay(g.validTo)}</span>}
              </span>
              <span className="watchlist-group__count">{g.items.length}</span>
            </h3>
            {g.items.map((p) => {
              const meta = STATUS_META[p.displayStatus] || STATUS_META.OPEN;
              const where = [p.area, p.location || "No location"].filter(Boolean).join(" · ");
              return (
                <Link key={p.rowNumber} href={`/permits/${p.rowNumber}`} className="watchlist-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="watchlist-row__ref">{p.reference}</div>
                    <div className="watchlist-row__meta">{where}</div>
                    {p.holder && <div className="watchlist-row__meta">{p.holder}</div>}
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
          </section>
        ))}
      </div>
      {viewAllHref && (
        <Link href={viewAllHref} className="watchlist-viewall">
          View all {totalCount} in the Permit List →
        </Link>
      )}
    </>
  );
}
