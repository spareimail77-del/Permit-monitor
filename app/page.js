import { fetchPermitData } from "../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../lib/status";
import { STATUS_META, normalizeStatus } from "../lib/statusMeta";
import Header from "./components/Header";
import StatCard from "./components/StatCard";
import DonutChart from "./components/DonutChart";
import BreakdownBars from "./components/BreakdownBars";
import ExpiringWatchlist from "./components/ExpiringWatchlist";
import ErrorScreen from "./components/ErrorScreen";
import EnterEffect from "./components/EnterEffect";

// Always read fresh from Blob — the dashboard should never show
// stale counts from a cached build.
export const dynamic = "force-dynamic";

function topCounts(values, limit = 6) {
  const counts = {};
  for (const v of values) {
    const key = v && v.trim() ? v.trim() : "Unspecified";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export default async function Dashboard() {
  const data = await fetchPermitData();

  if (data.error) {
    return <ErrorScreen message={data.message} />;
  }

  const today = todayInMuscat();
  const permits = data.permits.map((permit) => {
    const { displayStatus, daysRemaining } = computeDisplayStatus(
      permit,
      today
    );
    return {
      ...permit,
      displayStatus: normalizeStatus(displayStatus),
      daysRemaining,
    };
  });

  const counts = { OPEN: 0, EXPIRING_SOON: 0, EXPIRED: 0, CLOSED: 0, CANCELED: 0 };
  let other = 0;
  for (const p of permits) {
    if (counts[p.displayStatus] !== undefined) {
      counts[p.displayStatus]++;
    } else {
      other++;
    }
  }

  const allUpcoming = permits
    .filter(
      (p) =>
        (p.displayStatus === "OPEN" || p.displayStatus === "EXPIRING_SOON") &&
        typeof p.daysRemaining === "number"
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  const upcomingExpiries = allUpcoming.slice(0, 30);

  // Bars link to the Permit List filtered by that area / type.
  const withLink = (rows, param) =>
    rows.map((r) => ({
      ...r,
      href:
        r.label === "Unspecified"
          ? undefined
          : `/permits?${param}=${encodeURIComponent(r.label)}`,
    }));
  const areaBreakdown = withLink(topCounts(permits.map((p) => p.area)), "area");
  const typeBreakdown = withLink(topCounts(permits.map((p) => p.permitType)), "type");

  // Every status is its own flat slice — Open and Expiring Soon are mutually
  // exclusive counts (computeDisplayStatus returns one or the other), so this
  // adds up to `total` on its own with no inner ring or "of which" nesting.
  // The Active/Open *stat card* above still adds Open + Expiring Soon
  // together; only this chart shows them apart. meta.color is a
  // var(--color-open)-style reference, which SVG's `stroke` attribute
  // resolves fine at render time against the current theme.
  const resolvedSegments = Object.entries(STATUS_META).map(([key, meta]) => ({
    key,
    // The stat card above uses meta.label ("Active / Open") since it also
    // covers Expiring Soon; this chart splits them, so the plain "Open" is
    // the correct standalone label for that one slice.
    label: key === "OPEN" ? "Open" : meta.label,
    value: counts[key] || 0,
    color: meta.color,
    href: `/permits?status=${key}`,
  }));

  return (
    <main>
      <EnterEffect />
      <Header uploadedAt={data.uploadedAt} today={today} />
      <section style={styles.body}>
        {data.duplicateReferences.length > 0 && (
          <div className="notice">
            {data.duplicateReferences.length} reference number
            {data.duplicateReferences.length > 1 ? "s appear" : " appears"}{" "}
            more than once in the workbook — see the Permit List for
            details.
          </div>
        )}

        {permits.length === 0 ? (
          <div className="panel" style={{ padding: "24px 28px" }}>
            <p style={{ color: "var(--color-ink-muted)", margin: 0 }}>
              The uploaded file was read successfully but contains no
              permit rows yet.
            </p>
          </div>
        ) : (
          <>
            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <StatCard
                label="Total Permits"
                value={permits.length}
                icon="clipboard"
                href="/permits"
                hero
              />
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <StatCard
                  key={key}
                  label={meta.label}
                  value={key === "OPEN" ? counts.OPEN + counts.EXPIRING_SOON : counts[key]}
                  color={meta.color}
                  icon={meta.icon}
                  href={`/permits?status=${key}`}
                />
              ))}
              {other > 0 && (
                <StatCard label="Other / Unrecognized" value={other} icon="tag" />
              )}
            </div>

            <div className="dash-row">
              <div className="panel dash-panel" style={styles.panelPad}>
                <h2 className="panel-title">Status distribution</h2>
                <p className="panel-subtitle">
                  Hover a slice for details, click to open that list.
                </p>
                <div className="dash-panel__body dash-panel__body--center">
                  <DonutChart
                    segments={resolvedSegments}
                    total={permits.length}
                    centerLabel="permits"
                  />
                </div>
              </div>

              <div className="panel dash-panel" style={styles.panelPad}>
                <h2 className="panel-title">Expiring soon</h2>
                <p className="panel-subtitle">
                  Open permits grouped by expiry day, soonest first.
                </p>
                <div className="dash-panel__body">
                  <ExpiringWatchlist
                    permits={upcomingExpiries}
                    totalCount={allUpcoming.length}
                    viewAllHref="/permits?status=OPEN"
                  />
                </div>
              </div>
            </div>

            <div className="dash-row" style={{ marginTop: 16 }}>
              <div className="panel dash-panel" style={styles.panelPad}>
                <h2 className="panel-title">By area</h2>
                <p className="panel-subtitle">Permit count per work area. Click a bar to filter.</p>
                <div className="dash-panel__body">
                  <BreakdownBars rows={areaBreakdown} />
                </div>
              </div>

              <div className="panel dash-panel" style={styles.panelPad}>
                <h2 className="panel-title">By permit type</h2>
                <p className="panel-subtitle">Most common permit types. Click a bar to filter.</p>
                <div className="dash-panel__body">
                  <BreakdownBars rows={typeBreakdown} />
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const styles = {
  body: { maxWidth: 1120, margin: "0 auto", padding: "28px 20px 48px" },
  panelPad: { padding: "20px 24px" },
};
