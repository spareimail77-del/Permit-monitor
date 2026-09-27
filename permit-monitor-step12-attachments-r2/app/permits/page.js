import { fetchPermitData } from "../../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../../lib/status";
import { STATUS_META, normalizeStatus } from "../../lib/statusMeta";
import Header from "../components/Header";
import ErrorScreen from "../components/ErrorScreen";
import PermitTable from "../components/PermitTable";

export const dynamic = "force-dynamic";

export default async function PermitListPage({ searchParams }) {
  const data = await fetchPermitData();

  if (data.error) {
    return <ErrorScreen message={data.message} />;
  }

  // Only accept a status coming from the dashboard links — anything
  // else falls back to "show everything" rather than erroring.
  const requestedStatus = searchParams?.status;
  const initialStatus =
    requestedStatus && STATUS_META[requestedStatus] ? requestedStatus : "ALL";

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
        {data.duplicateReferences.length > 0 && (
          <div className="notice">
            {data.duplicateReferences.length} reference number
            {data.duplicateReferences.length > 1 ? "s appear" : " appears"}{" "}
            more than once in the workbook:{" "}
            <span className="mono">{data.duplicateReferences.join(", ")}</span>.
            Rows are still shown individually — check Excel to correct
            duplicates.
          </div>
        )}
        {permits.length === 0 ? (
          <p style={{ color: "var(--color-ink-muted)" }}>
            The uploaded file was read successfully but contains no
            permit rows.
          </p>
        ) : (
          <PermitTable
            permits={permits}
            duplicateReferences={data.duplicateReferences}
            initialStatus={initialStatus}
          />
        )}
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
