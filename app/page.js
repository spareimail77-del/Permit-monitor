import Link from "next/link";
import { getSupabase } from "../lib/db";
import { getViewer } from "../lib/viewer";
import { todayOman } from "../lib/omanDate";
import { STATUS_KEYS, STATUS_TEXT, addDays, computeStatus, isActiveKey } from "../lib/status";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const fmt = (iso) => (iso ? iso.split("-").reverse().join("-") : "—");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const listLink = (params) => `/permits?${new URLSearchParams(params).toString()}`;

// The 5 statuses, with the donut colours (the same names as the badge classes).
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
            <circle
              key={key}
              cx="70"
              cy="70"
              r={DONUT_R}
              fill="none"
              strokeWidth="22"
              className={`seg seg--${key}`}
              strokeDasharray={`${len} ${DONUT_C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
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
    </Link>
  );
}

function Attention({ title, rows, allHref, empty }) {
  return (
    <div className="panel pform-card">
      <h3 className="pform-title">{title}</h3>
      {rows.length === 0 ? (
        <p className="pform-hint">{empty}</p>
      ) : (
        <>
          <ul className="attn-list">
            {rows.slice(0, 8).map((r) => (
              <li key={r.id}>
                <Link href={`/permits/${r.id}`} className="mono">
                  {r.reference}
                </Link>
                <span className="attn-where">
                  {r.location || "—"}
                  {r.holder ? ` · ${r.holder}` : ""}
                </span>
                <span className={r.st.key === "OVERDUE" ? "status-detail status-detail--bad" : "status-detail"}>{r.st.detail}</span>
              </li>
            ))}
          </ul>
          {rows.length > 8 && (
            <p style={{ margin: "10px 0 0" }}>
              <Link href={allHref}>See all {rows.length} →</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Bars({ title, items, field }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="panel pform-card">
      <h3 className="pform-title">{title}</h3>
      {items.length === 0 ? (
        <p className="pform-hint">Nothing to show.</p>
      ) : (
        <ul className="bars">
          {items.map((i) => (
            <li key={i.label}>
              <Link href={listLink({ status: "active", [field]: i.label })} className="bar-label" title={i.label}>
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
  const viewer = await getViewer();
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
  const expiring = permits.filter((p) => p.st.key === "EXPIRING").sort((a, b) => a.st.daysLeft - b.st.daysLeft);
  const oldest = overdue[0]?.st.daysOverdue || 0;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-sub" style={{ margin: 0 }}>
            Data as of {fmt(today)} (Oman time)
          </p>
        </div>
        <div className="row-actions">
          {viewer?.canManagePermits && (
            <Link href="/permits/new" className="btn btn-primary">
              + New permit
            </Link>
          )}
          <Link href="/permits" className="btn">
            Permit list
          </Link>
        </div>
      </div>

      {failed && (
        <div className="notice">
          The permits could not be read. Has <span className="mono">supabase/01-permits.sql</span> been run, and are both
          environment variables set?
        </div>
      )}

      {counts.OVERDUE > 0 && (
        <div className="notice notice--danger">
          <strong>{plural(counts.OVERDUE, "permit")} overdue.</strong> The oldest ended {plural(oldest, "day")} ago.{" "}
          <Link href={listLink({ status: "overdue" })}>Show them →</Link>
        </div>
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
          <h3 className="pform-title">Status</h3>
          <div className="donut-wrap">
            <Donut counts={counts} total={total - other} />
            <ul className="legend">
              {STATUS_KEYS.map((k) => (
                <li key={k}>
                  <Link href={listLink({ status: k.toLowerCase() })}>
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
          <h3 className="pform-title">Ending in the next 14 days</h3>
          <div className="forecast" role="img" aria-label="Permits ending per day">
            {forecast.map((x, i) => (
              <div key={x.d} className="forecast__col" title={`${fmt(x.d)}: ${x.n}`}>
                <span className="forecast__n">{x.n || ""}</span>
                <span className={`forecast__bar${i === 0 ? " is-today" : ""}`} style={{ height: `${x.n ? Math.max(6, (x.n / fMax) * 90) : 2}px` }} />
                <span className="forecast__d">{x.d.slice(8, 10)}</span>
              </div>
            ))}
          </div>
          <p className="pform-hint" style={{ margin: "8px 0 0" }}>
            Open and expiring permits by their Valid to day. The first bar is today; overdue permits are not included.
          </p>
        </div>
      </div>

      <h3 className="section-title">Needs attention</h3>
      <div className="dash-grid">
        <Attention title={`Overdue (${counts.OVERDUE})`} rows={overdue} allHref={listLink({ status: "overdue" })} empty="No overdue permits." />
        <Attention title={`Expiring soon (${counts.EXPIRING})`} rows={expiring} allHref={listLink({ status: "expiring" })} empty="Nothing ends in the next 3 days." />
      </div>

      <h3 className="section-title">Active permits by…</h3>
      <div className="dash-grid">
        <Bars title="Area" items={top(activePermits, (p) => p.area)} field="area" />
        <Bars title="Type of permit" items={top(activePermits, (p) => p.permit_type)} field="type" />
        <Bars title="Applicant" items={top(activePermits, (p) => p.applicant)} field="applicant" />
        <Bars title="Holder" items={top(activePermits, (p) => p.holder)} field="holder" />
      </div>
    </>
  );
}
