import Link from "next/link";
import { STATUS_META } from "../../lib/statusMeta";

// Manager dashboard: open permits per Holder / Applicant, people with
// overdue permits first. Click a name to open the Permit List searched for
// that person. Pure display: no state, no extra data.

export default function PeopleBoard({ people }) {
  if (people.length === 0) {
    return <p className="people-empty">No open permits right now.</p>;
  }
  return (
    <div className="people">
      <div className="people__row people__row--head" aria-hidden="true">
        <span>Name</span>
        <span>Open</span>
        <span>Expiring</span>
        <span>Overdue</span>
      </div>
      <div className="people__scroll">
        {people.map((p, i) => (
          <Link
            key={p.name}
            prefetch={false}
            href={`/permits?q=${encodeURIComponent(p.name)}`}
            className={`people__row${p.overdue > 0 ? " has-overdue" : ""}`}
            style={{ "--i": Math.min(i, 12) }}
          >
            <span className="people__name">{p.name}</span>
            <span className="people__cell">{p.active}</span>
            <span
              className={`people__cell${p.expiring > 0 ? " is-on" : ""}`}
              style={{ "--cell-color": STATUS_META.EXPIRING_SOON.color }}
            >
              {p.expiring > 0 ? p.expiring : "–"}
            </span>
            <span
              className={`people__cell${p.overdue > 0 ? " is-on" : ""}`}
              style={{ "--cell-color": STATUS_META.OVERDUE.color }}
              title={p.overdue > 0 && p.oldest > 0 ? `Oldest overdue: ${p.oldest}d` : undefined}
            >
              {p.overdue > 0 ? p.overdue : "–"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
