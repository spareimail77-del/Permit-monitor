import { MINE_LABELS } from "../../lib/people";

// Small tag: your part in a permit. Renders nothing when it is not yours.
export default function RoleChip({ role, short = false }) {
  if (!role || !MINE_LABELS[role]) return null;
  const text = short && role === "both" ? "Both" : MINE_LABELS[role];
  return <span className={`role-chip role-chip--${role}`}>{text}</span>;
}
