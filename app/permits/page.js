import { fetchPermitData } from "../../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../../lib/status";
import { STATUS_META, normalizeStatus } from "../../lib/statusMeta";
import Header from "../components/Header";
import ErrorScreen from "../components/ErrorScreen";
import PermitTable from "../components/PermitTable";
import { createClient } from "../../lib/supabase/server";
import { getAccess, hasPermission } from "../../lib/authz";
import { getCurrentUser } from "../../lib/supabase/user";

export const dynamic = "force-dynamic";

// Attachment counts + whether this person may export. Metadata only (no file
// bytes), and a failure just means no indicators / no export button, never an
// error page. Runs at the same time as the permit data load below.
async function loadViewerExtras() {
  const attachmentCounts = {};
  let canExport = false;
  try {
    const supabase = createClient();
    const [user, { data: rows }] = await Promise.all([
      getCurrentUser(supabase),
      supabase.from("permit_attachments").select("permit_reference"),
    ]);
    if (user) {
      canExport = hasPermission(await getAccess(supabase, user.id), "export_data");
    }
    (rows || []).forEach((r) => {
      attachmentCounts[r.permit_reference] =
        (attachmentCounts[r.permit_reference] || 0) + 1;
    });
  } catch (err) {
    console.error("Could not load attachment counts:", err);
  }
  return { attachmentCounts, canExport };
}

export default async function PermitListPage({ searchParams }) {
  // Independent lookups, so they run together instead of one after another.
  const [data, { attachmentCounts, canExport }] = await Promise.all([
    fetchPermitData(),
    loadViewerExtras(),
  ]);

  if (data.error) {
    return <ErrorScreen message={data.message} />;
  }

  // Only accept a status coming from the dashboard links — anything
  // else falls back to "show everything" rather than erroring.
  // Old links used ?status=EXPIRED; that group is now called Overdue.
  const requestedStatus =
    searchParams?.status === "EXPIRED" ? "OVERDUE" : searchParams?.status;
  const initialStatus =
    requestedStatus && (STATUS_META[requestedStatus] || requestedStatus === "OPEN_ONLY")
      ? requestedStatus
      : "ALL";

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
      attachmentCount: attachmentCounts[permit.reference] || 0,
    };
  });

  // Only offered when the area / type from a dashboard link really exists.
  const areaParam = typeof searchParams?.area === "string" ? searchParams.area : "";
  const typeParam = typeof searchParams?.type === "string" ? searchParams.type : "";
  const initialArea = permits.some((p) => p.area === areaParam) ? areaParam : "ALL";
  const initialType = permits.some((p) => p.permitType === typeParam) ? typeParam : "ALL";

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
            initialArea={initialArea}
            initialType={initialType}
            canExport={canExport}
            template={canExport ? data.template : null}
            today={today}
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
