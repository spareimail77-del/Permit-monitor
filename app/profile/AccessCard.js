import Icon from "../components/Icon";
import { PERMISSION_LABELS, permissionsOf, roleLabel } from "../../lib/permissions";

const SHOWN_FIRST = 5;

// "Your access": what this role can do, in plain words. Built from the same
// permission list the site enforces, so it cannot drift out of date.
export default function AccessCard({ role }) {
  const items = permissionsOf(role)
    .filter((p) => PERMISSION_LABELS[p])
    .map((p) => PERMISSION_LABELS[p]);
  const first = items.slice(0, SHOWN_FIRST);
  const rest = items.slice(SHOWN_FIRST);

  return (
    <div className="panel pf-card">
      <h3 className="pf-card__title">Your access</h3>
      <p className="pf-card__sub">What the {roleLabel(role)} role can do on this site.</p>
      <ul className="pf-access">
        {first.map((label) => (
          <li key={label}>
            <Icon name="checkCircle" size={15} />
            {label}
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="pf-more">
          <summary>Show {rest.length} more</summary>
          <ul className="pf-access">
            {rest.map((label) => (
              <li key={label}>
                <Icon name="checkCircle" size={15} />
                {label}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
