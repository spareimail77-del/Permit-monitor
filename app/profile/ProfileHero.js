import { formatDay, initialsOf } from "../../lib/format";

// Top band of My profile: who you are at a glance. Server component.
export default function ProfileHero({ name, staffId, role, createdAt, lastSignIn }) {
  return (
    <div className="panel pf-hero">
      <span className="pf-avatar" aria-hidden="true">
        {initialsOf(name, staffId)}
      </span>
      <div className="pf-hero__main">
        <h2 className="pf-hero__name">{name || `Staff ${staffId}`}</h2>
        <p className="pf-hero__meta">
          <span className="mono">{staffId}</span>
          <span className="pf-role">{role}</span>
          <span className="pf-active">
            <span className="pf-active__dot" aria-hidden="true" />
            Active
          </span>
        </p>
      </div>
      <dl className="pf-hero__facts">
        {createdAt && (
          <div>
            <dt>Member since</dt>
            <dd>{formatDay(createdAt)}</dd>
          </div>
        )}
        {lastSignIn && (
          <div>
            <dt>Last sign-in</dt>
            <dd>{lastSignIn}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
