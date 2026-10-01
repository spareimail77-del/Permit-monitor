import Link from "next/link";
import Icon from "./Icon";
import { STATUS_META } from "../../lib/statusMeta";
import { daysText } from "../../lib/status";

// mode "expiring": open permits with a numeric daysRemaining, soonest first.
// mode "overdue":  OVERDUE permits, most overdue first (unknown days last).
// Grouped by Valid To day so a long run of identical badges becomes
// "Tomorrow · Wed 30 Sep — 17 permits" / "2 days overdue · Mon 28 Sep — 6".

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

function groupLabel(days, mode) {
  if (mode === "overdue") {
    if (typeof days !== "number") return "Overdue · no Valid To date";
    if (days >= 0) return "Overdue · ended today";
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

// Heading colour fades with urgency: red = past Valid To, strong amber = today
// or tomorrow, soft amber = 2-3 days (still "Expiring soon"), calm brand = later.
function groupTone(days, mode) {
  if (mode === "overdue") return "overdue";
  if (days <= 1) return "urgent";
  if (days <= 3) return "soon";
  return "calm";
}

export default function ExpiringWatchlist({ permits, totalCount, viewAllHref, mode = "expiring" }) {
  if (permits.length === 0) {
    return (
      <div className="watchlist-empty">
        <Icon name="checkCircle" size={16} style={{ color: "var(--color-open)" }} />
        {mode === "overdue"
          ? "No overdue permits. Every open permit is still within its Valid To date."
          : "No open permits with a Valid To date on record."}
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
          <section key={`${g.validTo}-${g.days}`} className={`watchlist-group watchlist-group--${groupTone(g.days, mode)}`}>
            <h3 className="watchlist-group__head">
              <span>
                {groupLabel(g.days, mode)}
                {g.validTo && <span className="watchlist-group__date"> · {formatDay(g.validTo)}</span>}
              </span>
              <span className="watchlist-group__count">{g.items.length}</span>
            </h3>
            {g.items.map((p) => {
              const meta = STATUS_META[p.displayStatus] || STATUS_META.OPEN;
              const where = [p.area, p.location || "No location"].filter(Boolean).join(" · ");
              return (
                <Link prefetch={false} key={p.rowNumber} href={`/permits/${p.rowNumber}`} className="watchlist-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="watchlist-row__ref">{p.reference}</div>
                    <div className="watchlist-row__meta">{where}</div>
                    {p.holder && <div className="watchlist-row__meta">{p.holder}</div>}
                  </div>
                  <span
                    className="watchlist-row__days"
                    style={{ background: meta.tint, color: meta.color }}
                  >
                    {daysText(p)}
                  </span>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
      {viewAllHref && (
        <Link prefetch={false} href={viewAllHref} className="watchlist-viewall">
          View all {totalCount} in the Permit List →
        </Link>
      )}
    </>
  );
}
