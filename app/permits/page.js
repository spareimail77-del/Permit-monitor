import { fetchPermitData } from "../../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../../lib/status";
import { normalizeStatus } from "../../lib/statusMeta";
import Header from "../components/Header";
import ErrorScreen from "../components/ErrorScreen";
import PermitTable from "../components/PermitTable";

export const dynamic = "force-dynamic";

export default async function PermitListPage() {
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

  return (
    <main>
      <Header uploadedAt={data.uploadedAt} today={today} />
      <section style={styles.body}>
        <h2 style={styles.sectionTitle}>Permit List</h2>
        <PermitTable permits={permits} />
      </section>
    </main>
  );
}

const styles = {
  body: { maxWidth: 1200, margin: "0 auto", padding: "28px 20px 48px" },
  sectionTitle: {
    fontSize: "var(--font-size-lg)",
    marginBottom: 14,
    color: "var(--color-ink)",
  },
};
