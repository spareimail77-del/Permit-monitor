import { STATUS_META } from "../../lib/statusMeta";

// Manager dashboard: how many open permits reach their Valid To date on each
// of the next 14 days. Crowded days show up early. Bars grow in when the
// page loads (CSS only). The first four days (today to 3 days ahead) use
// the Expiring Soon colour, because those permits are Expiring Soon.

export default function ExpiryForecast({ days, total, busiest }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="fc">
      <div className="fc__bars" role="img" aria-label={`${total} permits expire in the next ${days.length} days`}>
        {days.map((d) => {
          const soon = d.offset <= 3;
          return (
            <div
              key={d.offset}
              className={`fc__col${d.offset === 0 ? " is-today" : ""}${d.count === 0 ? " is-zero" : ""}`}
              title={`${d.full}: ${d.count} ${d.count === 1 ? "permit expires" : "permits expire"}`}
            >
              <span className="fc__num">{d.count > 0 ? d.count : ""}</span>
              <span className="fc__track">
                <span
                  className="fc__bar"
                  style={{
                    height: d.count > 0 ? `${Math.max(8, (d.count / max) * 100)}%` : "3px",
                    background: soon ? STATUS_META.EXPIRING_SOON.color : STATUS_META.OPEN.color,
                    "--i": d.offset,
                  }}
                />
              </span>
              <span className="fc__wd">{d.wd.slice(0, 1)}</span>
              <span className="fc__day">{d.day}</span>
            </div>
          );
        })}
      </div>
      <p className="fc__foot">
        {total === 0
          ? "No open permit reaches its Valid To date in this window."
          : `${total} ${total === 1 ? "permit expires" : "permits expire"} in the next ${days.length} days` +
            (busiest.count > 1 ? `. Busiest: ${busiest.full} (${busiest.count}).` : ".")}
      </p>
    </div>
  );
}
