import { fetchPermitData } from "../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../lib/status";
import { STATUS_META, normalizeStatus } from "../lib/statusMeta";
import Header from "./components/Header";
import StatCard from "./components/StatCard";
import ErrorScreen from "./components/ErrorScreen";

// Always read fresh from Blob — the dashboard should never show
// stale counts from a cached build.
export const dynamic = "force-dynamic";

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

  return (
    <main>
      <Header uploadedAt={data.uploadedAt} today={today} />
      <section style={styles.body}>
        <h2 style={styles.sectionTitle}>Summary</h2>
        <div style={styles.grid}>
          <StatCard label="Total Permits" value={permits.length} />
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <StatCard
              key={key}
              label={meta.label}
              value={counts[key]}
              color={meta.color}
            />
          ))}
          {other > 0 && (
            <StatCard label="Other / Unrecognized" value={other} />
          )}
        </div>
      </section>
    </main>
  );
}

const styles = {
  body: { maxWidth: 1080, margin: "0 auto", padding: "28px 20px 48px" },
  sectionTitle: {
    fontSize: "var(--font-size-lg)",
    marginBottom: 14,
    color: "var(--color-ink)",
  },
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
  },
};
