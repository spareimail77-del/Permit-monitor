import { fetchPermitData } from "../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../lib/status";
import { STATUS_META, normalizeStatus } from "../lib/statusMeta";
import Header from "./components/Header";
import StatCard from "./components/StatCard";
import DonutChart from "./components/DonutChart";
import BreakdownBars from "./components/BreakdownBars";
import ExpiringWatchlist from "./components/ExpiringWatchlist";
import ErrorScreen from "./components/ErrorScreen";

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

  const upcomingExpiries = permits
    .filter(
      (p) =>
        (p.displayStatus === "OPEN" || p.displayStatus === "EXPIRING_SOON") &&
        typeof p.daysRemaining === "number"
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 20);

  const areaBreakdown = topCounts(permits.map((p) => p.area));
  const typeBreakdown = topCounts(permits.map((p) => p.permitType));

  // meta.color is a var(--color-open) reference, which SVG's `stroke`
  // attribute resolves fine at render time against the current theme.
  const resolvedSegments = Object.entries(STATUS_META).map(([key, meta]) => ({
    label: meta.label,
    value: counts[key] || 0,
    color: meta.color,
  }));

  return (
    <main>
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
                  value={counts[key]}
                  color={meta.color}
                  icon={meta.icon}
                  href={`/permits?status=${key}`}
                />
              ))}
              {other > 0 && (
                <StatCard label="Other / Unrecognized" value={other} icon="tag" />
              )}
            </div>

            <div style={styles.twoCol}>
              <div className="panel" style={styles.panelPad}>
                <h2 className="panel-title">Status distribution</h2>
                <p className="panel-subtitle">
                  Share of every permit currently on record.
                </p>
                <div style={{ marginTop: 18 }}>
                  <DonutChart
                    segments={resolvedSegments}
                    total={permits.length}
                    centerLabel="permits"
                  />
                </div>
              </div>

              <div className="panel" style={styles.panelPad}>
                <h2 className="panel-title">Expiring soon</h2>
                <p className="panel-subtitle">
                  Open permits, soonest expiry first. Scroll for more.
                </p>
                <div style={{ marginTop: 12 }}>
                  <ExpiringWatchlist permits={upcomingExpiries} />
                </div>
              </div>
            </div>

            <div style={{ ...styles.twoCol, marginTop: 16 }}>
              <div className="panel" style={styles.panelPad}>
                <h2 className="panel-title">By area</h2>
                <p className="panel-subtitle">Permit count per work area.</p>
                <div style={{ marginTop: 18 }}>
                  <BreakdownBars rows={areaBreakdown} />
                </div>
              </div>

              <div className="panel" style={styles.panelPad}>
                <h2 className="panel-title">By permit type</h2>
                <p className="panel-subtitle">Most common permit types.</p>
                <div style={{ marginTop: 18 }}>
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
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
};
