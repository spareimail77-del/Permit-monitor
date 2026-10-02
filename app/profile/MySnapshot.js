import Link from "next/link";
import Icon from "../components/Icon";
import { MineStat } from "../components/MyPermitsPanel";
import { fetchPermitData } from "../../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../../lib/status";
import { normalizeStatus, STATUS_META } from "../../lib/statusMeta";
import { mineRole } from "../../lib/people";

// "My permits" at a glance, on the Overview tab. Async server component: the
// rest of the page is already on screen while this loads (Suspense).
export default async function MySnapshot({ names, role }) {
  if (names.length === 0) {
    // Only ordinary users need the hint; admins may not be in the log at all.
    if (role !== "permit_user") return null;
    return (
      <div className="panel pf-card">
        <h3 className="pf-card__title">My permits</h3>
        <div className="pf-hint">
          <Icon name="users" size={16} />
          <p>
            Your account is not linked to your name in the permit log yet. Ask HSE to link it, and your
            permits will show here.
          </p>
        </div>
      </div>
    );
  }

  const data = await fetchPermitData();
  if (data.error) {
    return (
      <div className="panel pf-card">
        <h3 className="pf-card__title">My permits</h3>
        <p className="pf-muted">The permit log could not be read just now.</p>
      </div>
    );
  }

  const nameSet = new Set(names);
  const today = todayInMuscat();
  const mine = [];
  for (const permit of data.permits) {
    const role = mineRole(permit, nameSet);
    if (!role) continue;
    const { displayStatus } = computeDisplayStatus(permit, today);
    mine.push({ role, status: normalizeStatus(displayStatus) });
  }

  const n = (...statuses) => mine.filter((p) => statuses.includes(p.status)).length;
  const active = n("OPEN", "EXPIRING_SOON", "OVERDUE");
  const expiring = n("EXPIRING_SOON");
  const overdue = n("OVERDUE");
  const asHolder = mine.filter((p) => p.role === "holder" || p.role === "both").length;
  const asApplicant = mine.filter((p) => p.role === "applicant" || p.role === "both").length;

  return (
    <div className="panel pf-card">
      <div className="pf-card__head">
        <div>
          <h3 className="pf-card__title">My permits</h3>
          <p className="pf-card__sub">
            {asHolder} as holder · {asApplicant} as applicant
          </p>
        </div>
        <Link prefetch={false} href="/permits?mine=1" className="pf-link">
          Open my permits →
        </Link>
      </div>
      <div className="mine-stats" style={{ marginTop: 14 }}>
        <MineStat label="Active" value={active} href="/permits?mine=1&status=OPEN" />
        <MineStat
          label="Expiring soon"
          value={expiring}
          color={STATUS_META.EXPIRING_SOON.color}
          href="/permits?mine=1&status=EXPIRING_SOON"
        />
        <MineStat
          label="Overdue"
          value={overdue}
          color={overdue > 0 ? STATUS_META.OVERDUE.color : undefined}
          urgent={overdue > 0}
          href="/permits?mine=1&status=OVERDUE"
        />
        <MineStat label="All mine" value={mine.length} href="/permits?mine=1" />
      </div>
    </div>
  );
}
