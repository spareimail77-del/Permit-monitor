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
  // Still open, but past its Valid To date. (Excel calls this "EXPIRED";
  // the site never uses that word.) Reuses the existing red tokens.
  OVERDUE: {
    label: "Overdue",
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

// "Active / Open" includes Expiring Soon and Overdue: both are still open,
// just close to / past their Valid To date. Every other status matches
// only itself.
export function matchesStatusFilter(displayStatus, filter) {
  if (filter === "ALL") return true;
  if (filter === "OPEN") {
    return (
      displayStatus === "OPEN" ||
      displayStatus === "EXPIRING_SOON" ||
      displayStatus === "OVERDUE"
    );
  }
  // "On track": open, not expiring soon, not overdue.
  if (filter === "OPEN_ONLY") return displayStatus === "OPEN";
  // Old saved links used ?status=EXPIRED.
  if (filter === "EXPIRED") return displayStatus === "OVERDUE";
  return displayStatus === filter;
}

// Excel's dropdown uses "CANCELED"; this tolerates "CANCELLED" too
// in case anyone ever types the double-L spelling.
export function normalizeStatus(status) {
  if (status === "CANCELLED") return "CANCELED";
  if (status === "EXPIRED") return "OVERDUE";
  return status;
}
