// The status of a permit as a coloured badge, with optional "3 days left" text.
// `status` comes from computeStatus() in lib/status.js.
export default function StatusBadge({ status, showDetail = false }) {
  return (
    <span>
      <span className={`badge badge--${status.key}`}>{status.label}</span>
      {showDetail && status.detail && (
        <span className={status.key === "OVERDUE" ? "status-detail status-detail--bad" : "status-detail"}>{status.detail}</span>
      )}
    </span>
  );
}
