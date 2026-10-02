import Icon from "./Icon";

// Shown on the dashboard to ordinary users whose account is not yet linked to
// a name in the permit log, so they know why "My permits" is missing.
export default function UnlinkedNotice() {
  return (
    <div className="panel mine-panel mine-panel--empty">
      <Icon name="users" size={18} />
      <div>
        <strong>Your account is not linked to your name in the permit log yet.</strong>
        <p>
          Ask HSE to link it. Then the permits where you are the holder or applicant show up here, and you can
          filter the Permit List to them.
        </p>
      </div>
    </div>
  );
}
