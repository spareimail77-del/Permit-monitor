import Link from "next/link";
import Icon from "./Icon";
import { STATUS_META } from "../../lib/statusMeta";
import { daysText } from "../../lib/status";
import RoleChip from "./RoleChip";

// Top of the dashboard for people whose account is linked to Excel names:
// their own numbers and the permits of theirs that need action first.
// `mine` = permits where they are holder and/or applicant, each carrying
// p.mine ("holder" | "applicant" | "both") and the usual status fields.
export default function MyPermitsPanel({ mine, names }) {
  const by = { OPEN: 0, EXPIRING_SOON: 0, OVERDUE: 0, DONE: 0 };
  let asHolder = 0;
  let asApplicant = 0;
  for (const p of mine) {
    if (p.displayStatus === "CLOSED" || p.displayStatus === "CANCELED") by.DONE++;
    else if (by[p.displayStatus] !== undefined) by[p.displayStatus]++;
    if (p.mine === "holder" || p.mine === "both") asHolder++;
    if (p.mine === "applicant" || p.mine === "both") asApplicant++;
  }
  const active = by.OPEN + by.EXPIRING_SOON + by.OVERDUE;

  // Needs action: overdue (most overdue first), then expiring soon (soonest first).
  const days = (p) => (typeof p.daysRemaining === "number" ? p.daysRemaining : 1e9);
  const attention = mine
    .filter((p) => p.displayStatus === "OVERDUE" || p.displayStatus === "EXPIRING_SOON")
    .sort((a, b) => {
      const ao = a.displayStatus === "OVERDUE" ? 0 : 1;
      const bo = b.displayStatus === "OVERDUE" ? 0 : 1;
      return ao - bo || days(a) - days(b);
    });
  const shown = attention.slice(0, 6);

  return (
    <div className="panel mine-panel">
      <div className="mine-panel__head">
        <div>
          <h2 className="panel-title" style={{ margin: 0 }}>My permits</h2>
          <p className="panel-subtitle" style={{ margin: "4px 0 0" }}>
            {names.length > 0 ? (
              <>
                Where you are the holder or applicant:{" "}
                <span className="mono">{names.join(" · ")}</span>
              </>
            ) : (
              "Where you are the holder or applicant."
            )}
          </p>
        </div>
        <Link prefetch={false} href="/permits?mine=1" className="mine-panel__all">
          All {mine.length} →
        </Link>
      </div>

      {mine.length === 0 ? (
        <div className="watchlist-empty" style={{ marginTop: 14 }}>
          <Icon name="checkCircle" size={16} style={{ color: "var(--color-open)" }} />
          No permits in the current log list you as holder or applicant.
        </div>
      ) : (
        <>
          <div className="mine-stats">
            <MineStat label="Active" value={active} href="/permits?mine=1&status=OPEN" />
            <MineStat
              label="Expiring soon"
              value={by.EXPIRING_SOON}
              color={STATUS_META.EXPIRING_SOON.color}
              href="/permits?mine=1&status=EXPIRING_SOON"
            />
            <MineStat
              label="Overdue"
              value={by.OVERDUE}
              color={by.OVERDUE > 0 ? STATUS_META.OVERDUE.color : undefined}
              urgent={by.OVERDUE > 0}
              href="/permits?mine=1&status=OVERDUE"
            />
            <MineStat label="Closed / canceled" value={by.DONE} href="/permits?mine=1&status=ALL" />
          </div>
          <p className="mine-split">
            <span>{asHolder} as holder</span>
            <span>{asApplicant} as applicant</span>
          </p>

          {shown.length === 0 ? (
            <div className="watchlist-empty">
              <Icon name="checkCircle" size={16} style={{ color: "var(--color-open)" }} />
              Nothing needs action. None of your permits is overdue or about to expire.
            </div>
          ) : (
            <div className="mine-list">
              <h3 className="mine-list__title">Needs your action</h3>
              {shown.map((p) => {
                const meta = STATUS_META[p.displayStatus] || STATUS_META.OPEN;
                const where = [p.area, p.location].filter(Boolean).join(" · ");
                return (
                  <Link prefetch={false} key={p.rowNumber} href={`/permits/${p.rowNumber}`} className="watchlist-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="watchlist-row__ref">
                        {p.reference} <RoleChip role={p.mine} />
                      </div>
                      <div className="watchlist-row__meta">{where || "No location"}</div>
                    </div>
                    <span className="watchlist-row__days" style={{ background: meta.tint, color: meta.color }}>
                      {daysText(p)}
                    </span>
                  </Link>
                );
              })}
              {attention.length > shown.length && (
                <Link
                  prefetch={false}
                  href="/permits?mine=1&status=OPEN"
                  className="watchlist-viewall"
                >
                  {attention.length - shown.length} more need action →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MineStat({ label, value, color, urgent, href }) {
  return (
    <Link prefetch={false} href={href} className={`mine-stat${urgent ? " mine-stat--urgent" : ""}`}>
      <span className="mine-stat__value" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="mine-stat__label">{label}</span>
    </Link>
  );
}
