import Link from "next/link";
import { fetchPermitData } from "../../../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../../../lib/status";
import { normalizeStatus } from "../../../lib/statusMeta";
import Header from "../../components/Header";
import ErrorScreen from "../../components/ErrorScreen";
import StatusBadge from "../../components/StatusBadge";
import DetailField from "../../components/DetailField";

export const dynamic = "force-dynamic";

export default async function PermitDetailPage({ params }) {
  const data = await fetchPermitData();

  if (data.error) {
    return <ErrorScreen message={data.message} />;
  }

  const today = todayInMuscat();
  const targetRow = Number(params.rowNumber);
  const raw = data.permits.find((p) => p.rowNumber === targetRow);

  if (!raw) {
    return (
      <main>
        <Header uploadedAt={data.uploadedAt} today={today} />
        <section style={styles.body}>
          <Link href="/permits" className="back-link">
            ← Back to Permit List
          </Link>
          <div style={styles.notFound}>
            <h2 style={{ marginTop: 0 }}>Permit not found</h2>
            <p style={{ color: "var(--color-ink-muted)" }}>
              No permit at that reference in the current data. It may
              have been removed from the workbook, or the link may be
              out of date — try going back to the list.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const { displayStatus, daysRemaining } = computeDisplayStatus(raw, today);
  const permit = { ...raw, displayStatus: normalizeStatus(displayStatus), daysRemaining };
  const isDuplicateRef = (data.duplicateReferences || []).includes(
    permit.reference
  );

  return (
    <main>
      <Header uploadedAt={data.uploadedAt} today={today} />
      <section style={styles.body}>
        <Link href="/permits" className="back-link">
          ← Back to Permit List
        </Link>

        <div style={styles.titleRow}>
          <h2 style={styles.title}>
            Permit <span className="mono">{permit.reference}</span>
          </h2>
          <StatusBadge status={permit.displayStatus} />
        </div>

        {isDuplicateRef && (
          <div style={styles.warning}>
            More than one row in the workbook uses reference{" "}
            <span className="mono">{permit.reference}</span>. Showing
            workbook row {permit.rowNumber} — check the Excel file for
            the duplicate.
          </div>
        )}

        {permit.excelStatus === "OPEN" && !permit.validTo && (
          <div style={styles.warning}>
            This permit is OPEN but has no Valid To date on file, so
            Expiring Soon can't be calculated for it. Check the date in
            Excel.
          </div>
        )}

        <div style={styles.card}>
          <h3 style={styles.groupTitle}>Overview</h3>
          <dl className="detail-grid">
            <DetailField label="Area" value={permit.area} />
            <DetailField label="Location" value={permit.location} />
            <DetailField label="Permit Type" value={permit.permitType} />
            <DetailField
              label="Days Remaining"
              value={permit.daysRemaining !== null ? permit.daysRemaining : "—"}
              mono
            />
            <DetailField
              label="Excel Status (source)"
              value={permit.excelStatus}
              mono
            />
          </dl>
        </div>

        <div style={styles.card}>
          <h3 style={styles.groupTitle}>Validity</h3>
          <dl className="detail-grid">
            <DetailField label="Valid From" value={permit.validFrom} mono />
            <DetailField label="Valid To" value={permit.validTo} mono />
          </dl>
        </div>

        <div style={styles.card}>
          <h3 style={styles.groupTitle}>Job Details</h3>
          <dl className="detail-grid">
            <DetailField label="Job Description" value={permit.jobDescription} />
            <DetailField label="Associated Certificates" value={permit.certificates} />
            <DetailField label="Certificate No." value={permit.certificateNo} mono />
          </dl>
        </div>

        <div style={styles.card}>
          <h3 style={styles.groupTitle}>People</h3>
          <dl className="detail-grid">
            <DetailField label="Applicant" value={permit.applicant} />
            <DetailField label="Permit Holder" value={permit.holder} />
            <DetailField label="Authorized Issuer" value={permit.issuer} />
            <DetailField label="Area Authority" value={permit.areaAuthority} />
            <DetailField label="Permit Controller" value={permit.controller} />
          </dl>
        </div>
      </section>
    </main>
  );
}

const styles = {
  body: { maxWidth: 900, margin: "0 auto", padding: "28px 20px 48px" },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  title: { fontSize: "var(--font-size-xl)", margin: 0 },
  card: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-md)",
    padding: "20px 24px",
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: "var(--font-size-sm)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-muted)",
    marginTop: 0,
    marginBottom: 16,
  },
  notFound: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-md)",
    padding: "24px 28px",
    maxWidth: 480,
  },
  warning: {
    background: "var(--color-expiring-tint)",
    border: "1px solid var(--color-expiring)",
    color: "var(--color-ink)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 14px",
    fontSize: "var(--font-size-sm)",
    marginBottom: 16,
  },
};
