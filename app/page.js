import { fetchPermitData } from "../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../lib/status";
import { STATUS_META, normalizeStatus } from "../lib/statusMeta";
import Header from "./components/Header";
import StatCard from "./components/StatCard";
import DonutChart from "./components/DonutChart";
import BreakdownBars from "./components/BreakdownBars";
import AttentionPanel from "./components/AttentionPanel";
import MyPermitsAlert from "./components/MyPermitsAlert";
import ManagerBrief from "./components/ManagerBrief";
import PeopleBoard from "./components/PeopleBoard";
import ExpiryForecast from "./components/ExpiryForecast";
import { buildManagerView } from "../lib/managerView";
import { normalizeRole } from "../lib/permissions";
import UnlinkedNotice from "./components/UnlinkedNotice";
import { createClient } from "../lib/supabase/server";
import { loadViewer } from "../lib/viewer";
import { mineRole } from "../lib/people";
import ErrorScreen from "./components/ErrorScreen";
import EnterEffect from "./components/EnterEffect";
import "./overdue.css";

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
  // The permit data and "who is looking" are independent: load together.
  const [data, viewer] = await Promise.all([
    fetchPermitData(),
    loadViewer(createClient()),
  ]);

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
      mine: mineRole(permit, viewer.names),
    };
  });

  // Permits where this person is the holder and/or applicant.
  const minePermits = permits.filter((p) => p.mine);
  // Only these few numbers go to the browser for the alert tile.
  const mineCounts = { active: 0, expiring: 0, overdue: 0, done: 0 };
  for (const p of minePermits) {
    if (p.displayStatus === "CLOSED" || p.displayStatus === "CANCELED") mineCounts.done++;
    else if (p.displayStatus === "OVERDUE") mineCounts.overdue++;
    else if (p.displayStatus === "EXPIRING_SOON") mineCounts.expiring++;
    else if (p.displayStatus === "OPEN") mineCounts.active++;
  }
  // "Active" on the tile matches the Permit List filter: every open permit,
  // including expiring soon and overdue.
  mineCounts.active += mineCounts.expiring + mineCounts.overdue;
  const showMine = viewer.names.size > 0;
  // Managers get an overview built from the same permits (no extra reads).
  const isManager =
    viewer.access.active && normalizeRole(viewer.access.role) === "manager";
  const mgr = isManager ? buildManagerView(permits, today) : null;
  // Ordinary users with no linked name get a hint instead of a blank space.
  const showUnlinkedHint =
    !showMine &&
    viewer.linksAvailable &&
    viewer.access.active &&
    viewer.access.role === "permit_user";

  const counts = { OPEN: 0, EXPIRING_SOON: 0, OVERDUE: 0, CLOSED: 0, CANCELED: 0 };
  let other = 0;
  for (const p of permits) {
    if (counts[p.displayStatus] !== undefined) {
      counts[p.displayStatus]++;
    } else {
      other++;
    }
  }

  // The list shows every open permit that has a Valid To date, soonest
  // first (1 day left, 2 days left ... n days left). The tab NUMBER is only
  // the permits whose status is really Expiring Soon (3 days or less), so it
  // always agrees with the stat card and the donut.
  const allUpcoming = permits
    .filter(
      (p) =>
        (p.displayStatus === "OPEN" || p.displayStatus === "EXPIRING_SOON") &&
        typeof p.daysRemaining === "number"
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  const upcomingExpiries = allUpcoming.slice(0, 30);

  // Overdue = still open, past Valid To. Most overdue first; permits with
  // no Valid To date (days unknown) go last.
  const allOverdue = permits
    .filter((p) => p.displayStatus === "OVERDUE")
    .sort(
      (a, b) =>
        (typeof a.daysRemaining === "number" ? a.daysRemaining : 1e9) -
        (typeof b.daysRemaining === "number" ? b.daysRemaining : 1e9)
    );
  const overdueList = allOverdue.slice(0, 50);
  const oldestOverdueDays =
    allOverdue.length > 0 && typeof allOverdue[0].daysRemaining === "number" && allOverdue[0].daysRemaining < 0
      ? Math.abs(allOverdue[0].daysRemaining)
      : 0;
  const overdueHint =
    counts.OVERDUE === 0
      ? "None overdue"
      : oldestOverdueDays > 0
      ? `Oldest: ${oldestOverdueDays}d`
      : "Ended today";

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

  // One ring, five mutually exclusive slices that add up to every permit:
  // On track + Expiring Soon + Overdue (all three are "open") + Closed +
  // Canceled. The centre shows how many of them are open.
  const openTotal = counts.OPEN + counts.EXPIRING_SOON + counts.OVERDUE;
  const resolvedSegments = [
    {
      key: "ON_TRACK",
      label: "On track",
      value: counts.OPEN,
      color: STATUS_META.OPEN.color,
      href: "/permits?status=OPEN_ONLY",
    },
    ...["EXPIRING_SOON", "OVERDUE", "CLOSED", "CANCELED"].map((key) => ({
      key,
      label: STATUS_META[key].label,
      value: counts[key] || 0,
      color: STATUS_META[key].color,
      href: `/permits?status=${key}`,
      // A soft breathing pulse while something is overdue.
      pulse: key === "OVERDUE" && counts.OVERDUE > 0,
    })),
  ];

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
            {mgr && (
              <ManagerBrief
                tone={mgr.tone}
                headline={mgr.headline}
                sub={mgr.sub}
                summaryText={mgr.summaryText}
              />
            )}
            {showMine && <MyPermitsAlert counts={mineCounts} />}
            {showUnlinkedHint && <UnlinkedNotice />}

            <div className="stat-grid stat-grid--live" style={{ marginBottom: 16 }}>
              <StatCard
                label="Total Permits"
                value={permits.length}
                icon="clipboard"
                href="/permits"
                hero
              />
              {Object.entries(STATUS_META).map(([key, meta]) => {
                if (key === "OVERDUE") {
                  // Urgent red tile while anything is overdue; calm green
                  // "None overdue" tile when nothing is.
                  const any = counts.OVERDUE > 0;
                  return (
                    <StatCard
                      key={key}
                      label={meta.label}
                      value={counts.OVERDUE}
                      color={any ? meta.color : STATUS_META.OPEN.color}
                      icon={any ? meta.icon : "checkCircle"}
                      href={`/permits?status=${key}`}
                      urgent={any}
                      hint={overdueHint}
                    />
                  );
                }
                return (
                  <StatCard
                    key={key}
                    label={meta.label}
                    value={key === "OPEN" ? openTotal : counts[key]}
                    color={meta.color}
                    icon={meta.icon}
                    href={`/permits?status=${key}`}
                  />
                );
              })}
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
                    centerValue={openTotal}
                    centerLabel="open"
                    centerSub={`of ${permits.length} permits`}
                  />
                </div>
              </div>

              <div className="panel dash-panel" style={styles.panelPad}>
                <AttentionPanel
                  overdue={overdueList}
                  overdueTotal={allOverdue.length}
                  expiring={upcomingExpiries}
                  expiringTotal={counts.EXPIRING_SOON}
                  expiringListTotal={allUpcoming.length}
                />
              </div>
            </div>

            {mgr && (
              <div className="dash-row" style={{ marginTop: 16 }}>
                <div className="panel dash-panel" style={styles.panelPad}>
                  <h2 className="panel-title">Holders &amp; Applicants</h2>
                  <p className="panel-subtitle">
                    Open permits per person, overdue first. A permit counts for both its holder and its
                    applicant. Click a name to see their permits.
                  </p>
                  <div className="dash-panel__body">
                    <PeopleBoard people={mgr.people} />
                  </div>
                </div>
                <div className="panel dash-panel" style={styles.panelPad}>
                  <h2 className="panel-title">Next 14 days</h2>
                  <p className="panel-subtitle">Open permits reaching their Valid To date, day by day.</p>
                  <div className="dash-panel__body">
                    <ExpiryForecast {...mgr.forecast} />
                  </div>
                </div>
              </div>
            )}

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
