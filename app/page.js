import Link from "next/link";
import { getSupabase } from "../lib/db";
import { todayOman } from "../lib/omanDate";
import { STATUS_KEYS, STATUS_TEXT, addDays, computeStatus, isActiveKey } from "../lib/status";
import PageHeader from "./components/PageHeader";
import NeedsAttention from "./components/NeedsAttention";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const fmt = (iso) => (iso ? iso.split("-").reverse().join("-") : "—");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const listLink = (params) => `/permits?${new URLSearchParams(params).toString()}`;

// The 5 statuses, with the donut colours (the same names as the badge classes).
const Arrow = ({ className = "" }) => (
  <svg className={`arrow ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const AlertIcon = () => (
  <svg className="alert-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01" />
  </svg>
);

const DONUT_R = 54;
const DONUT_C = 2 * Math.PI * DONUT_R;

function Donut({ counts, total }) {
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" width="160" height="160" role="img" aria-label="Permits by status">
      <circle cx="70" cy="70" r={DONUT_R} fill="none" strokeWidth="22" className="seg seg--none" />
      {total > 0 &&
        STATUS_KEYS.map((key) => {
          const len = (counts[key] / total) * DONUT_C;
          if (len <= 0) return null;
          const el = (
            <Link key={key} href={listLink({ status: key.toLowerCase() })} aria-label={`${STATUS_TEXT[key]}: ${counts[key]}`}>
              <circle
                cx="70"
                cy="70"
                r={DONUT_R}
                fill="none"
                strokeWidth="22"
                className={`seg seg--${key}`}
                strokeDasharray={`${len} ${DONUT_C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${STATUS_TEXT[key]}: ${counts[key]}`}</title>
              </circle>
            </Link>
          );
          offset += len;
          return el;
        })}
      <text x="70" y="68" textAnchor="middle" className="donut-n">
        {total}
      </text>
      <text x="70" y="86" textAnchor="middle" className="donut-l">
        permits
      </text>
    </svg>
  );
}

function StatCard({ href, n, label, sub, tone }) {
  return (
    <Link href={href} className={`panel stat-card${tone ? ` stat-card--${tone}` : ""}`}>
      <span className="stat-card__n">{n}</span>
      <span className="stat-card__l">{label}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
      <Arrow className="stat-card__go" />
    </Link>
  );
}

function Bars({ title, items, field }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="panel pform-card">
      <h2 className="pform-title">{title}</h2>
      {items.length === 0 ? (
        <p className="empty empty--compact">Nothing to show.</p>
      ) : (
        <ul className="bars">
          {items.map((i) => (
            <li key={i.label} className="bar-row">
              <Link href={listLink({ status: "active", [field]: i.label })} className="bar-label" title={`${i.label}: ${i.n} active`}>
                {i.label}
              </Link>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(i.n / max) * 100}%` }} />
              </span>
              <span className="bar-n">{i.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function top(permits, getter, n = 8) {
  const map = new Map();
  for (const p of permits) {
    const v = getter(p);
    if (v) map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, n: count }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, n);
}

export default async function Home() {
  const today = todayOman();

  const rows = [];
  let failed = false;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from("permits")
      .select("id, reference, area, location, permit_type, applicant, holder, valid_to, status")
      .is("deleted_at", null)
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Reading permits for the dashboard failed:", error);
      failed = true;
      break;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const permits = rows.map((r) => ({ ...r, st: computeStatus(r, today) }));
  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  let other = 0;
  for (const p of permits) {
    if (counts[p.st.key] !== undefined) counts[p.st.key] += 1;
    else other += 1;
  }
  const total = permits.length;
  const active = counts.OPEN + counts.EXPIRING + counts.OVERDUE;

  const overdue = permits.filter((p) => p.st.key === "OVERDUE").sort((a, b) => b.st.daysOverdue - a.st.daysOverdue);
    const oldest = overdue[0]?.st.daysOverdue || 0;

  // Rows for the "Needs attention" tile. Expiring looks 7 days ahead, so it also
  // holds permits whose status is still plain Open (4 to 7 days left).
  const slim = (p) => ({
    id: p.id,
    reference: p.reference,
    location: p.location || "",
    holder: p.holder || "",
    type: p.permit_type || "",
    validTo: p.valid_to || "",
    daysLeft: p.st.daysLeft,
    daysOverdue: p.st.daysOverdue,
  });
  const overdueRows = overdue.map(slim);
  const expiringRows = permits
    .filter((p) => (p.st.key === "OPEN" || p.st.key === "EXPIRING") && p.st.daysLeft !== null && p.st.daysLeft <= 7)
    .sort((a, b) => a.st.daysLeft - b.st.daysLeft)
    .map(slim);

  const activePermits = permits.filter((p) => isActiveKey(p.st.key));

  // 14-day forecast: how many OPEN / EXPIRING permits end on each of the next 14 days.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const forecast = days.map((d) => ({
    d,
    n: activePermits.filter((p) => p.st.key !== "OVERDUE" && p.valid_to === d).length,
  }));
  const fMax = Math.max(1, ...forecast.map((x) => x.n));

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={`Data as of ${fmt(today)} (Oman time)`}
      />

      {failed && (
        <div className="notice notice--danger">
          The permits could not be read. Has <span className="mono">supabase/01-permits.sql</span> been run, and are both
          environment variables set?
        </div>
      )}

      {counts.OVERDUE > 0 && (
        <Link href={listLink({ status: "overdue" })} className="notice notice--danger alert-banner">
          <AlertIcon />
          <span className="alert-banner__text">
            <strong>{plural(counts.OVERDUE, "permit")} overdue.</strong> The oldest ended {plural(oldest, "day")} ago.
          </span>
          <span className="alert-banner__cta">
            Show them <Arrow />
          </span>
        </Link>
      )}

      <div className="stat-grid">
        <StatCard href="/permits" n={total} label="Total permits" />
        <StatCard href={listLink({ status: "active" })} n={active} label="Active / Open" sub="open + expiring + overdue" tone="ok" />
        <StatCard href={listLink({ status: "expiring" })} n={counts.EXPIRING} label="Expiring soon" sub="0 to 3 days left" tone="warn" />
        <StatCard
          href={listLink({ status: "overdue" })}
          n={counts.OVERDUE}
          label="Overdue"
          sub={counts.OVERDUE > 0 ? `oldest ${plural(oldest, "day")}` : "none"}
          tone={counts.OVERDUE > 0 ? "bad" : undefined}
        />
        <StatCard href={listLink({ status: "closed" })} n={counts.CLOSED} label="Closed" />
        <StatCard href={listLink({ status: "canceled" })} n={counts.CANCELED} label="Canceled" />
        {other > 0 && <StatCard href="/permits" n={other} label="Other / unrecognized" sub="status not known" />}
      </div>

      <div className="dash-grid">
        <div className="panel pform-card">
          <h2 className="pform-title">Status</h2>
          <div className="donut-wrap">
            <Donut counts={counts} total={total - other} />
            <ul className="legend">
              {STATUS_KEYS.map((k) => (
                <li key={k}>
                  <Link href={listLink({ status: k.toLowerCase() })} data-k={k}>
                    <span className={`dot dot--${k}`} />
                    {STATUS_TEXT[k]}
                    <strong>{counts[k]}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel pform-card">
          <h2 className="pform-title">Ending in the next 14 days</h2>
          <div className="forecast" role="group" aria-label="Permits ending per day">
            {forecast.map((x, i) => (
              <div key={x.d} className="forecast__col" data-tip={`${fmt(x.d)} · ${plural(x.n, "permit")}`} tabIndex={0}>
                <span className="forecast__n">{x.n || ""}</span>
                <span className={`forecast__bar${i === 0 ? " is-today" : ""}`} style={{ height: `${x.n ? Math.max(6, (x.n / fMax) * 90) : 3}px` }} />
                <span className="forecast__d">{x.d.slice(8, 10)}</span>
              </div>
            ))}
          </div>
          <p className="pform-hint card-foot">
            Open and expiring permits by their Valid to day. The first bar is today; overdue permits are not included.
          </p>
        </div>
      </div>

      <h2 className="section-title">Needs attention</h2>
      <NeedsAttention overdue={overdueRows} expiring={expiringRows} overdueHref={listLink({ status: "overdue" })} />

      <h2 className="section-title">Active permits by…</h2>
      <div className="dash-grid dash-grid--4">
        <Bars title="Area" items={top(activePermits, (p) => p.area)} field="area" />
        <Bars title="Type of permit" items={top(activePermits, (p) => p.permit_type)} field="type" />
        <Bars title="Applicant" items={top(activePermits, (p) => p.applicant)} field="applicant" />
        <Bars title="Holder" items={top(activePermits, (p) => p.holder)} field="holder" />
      </div>
    </>
  );
}
