import { STATUS_META } from "../../lib/statusMeta";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  if (!meta) {
    return (
      <span
        className="status-badge"
        style={{ background: "var(--color-rule)", color: "var(--color-ink-muted)" }}
      >
        {status || "UNKNOWN"}
      </span>
    );
  }
  return (
    <span
      className="status-badge"
      style={{ background: meta.tint, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}
