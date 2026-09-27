// Presentation only — no logic here. Colors reference the CSS
// variables defined in app/globals.css.
export const STATUS_META = {
  OPEN: {
    label: "Active / Open",
    color: "var(--color-open)",
    tint: "var(--color-open-tint)",
    icon: "checkCircle",
  },
  EXPIRING_SOON: {
    label: "Expiring Soon",
    color: "var(--color-expiring)",
    tint: "var(--color-expiring-tint)",
    icon: "clock",
  },
  EXPIRED: {
    label: "Expired",
    color: "var(--color-expired)",
    tint: "var(--color-expired-tint)",
    icon: "alertTriangle",
  },
  CLOSED: {
    label: "Closed",
    color: "var(--color-closed)",
    tint: "var(--color-closed-tint)",
    icon: "archive",
  },
  CANCELED: {
    label: "Canceled",
    color: "var(--color-canceled)",
    tint: "var(--color-canceled-tint)",
    icon: "xCircle",
  },
};

// Excel's dropdown uses "CANCELED"; this tolerates "CANCELLED" too
// in case anyone ever types the double-L spelling.
export function normalizeStatus(status) {
  if (status === "CANCELLED") return "CANCELED";
  return status;
}
