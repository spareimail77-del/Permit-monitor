// Permit status as people see it. The database stores only OPEN, CLOSED or
// CANCELED. Overdue and Expiring soon are WORKED OUT every time a page loads,
// from Valid to and today's date in Oman time (see lib/omanDate.js). They are
// never stored and never chosen on a form.

export const EXPIRING_DAYS = 3; // 0 to 3 days left = Expiring soon

export const STATUS_KEYS = ["OPEN", "EXPIRING", "OVERDUE", "CLOSED", "CANCELED"];
export const STATUS_TEXT = {
  OPEN: "Open",
  EXPIRING: "Expiring soon",
  OVERDUE: "Overdue",
  CLOSED: "Closed",
  CANCELED: "Canceled",
  OTHER: "Other",
};

// "YYYY-MM-DD" -> milliseconds at 00:00 UTC (calendar-day arithmetic only, so no
// time zone or daylight-saving surprises). null if it is not a real date.
function dayMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(ms);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? ms : null;
}

// Whole days from one date to another (negative if `to` is earlier). null if either is invalid.
export function daysBetween(fromISO, toISO) {
  const a = dayMs(fromISO);
  const b = dayMs(toISO);
  return a === null || b === null ? null : Math.round((b - a) / 86400000);
}

export function addDays(iso, n) {
  const ms = dayMs(iso);
  return ms === null ? null : new Date(ms + n * 86400000).toISOString().slice(0, 10);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// permit: { status, valid_to }, today: "YYYY-MM-DD" (Oman).
// Returns { key, label, detail, daysLeft, daysOverdue, noValidTo }.
export function computeStatus(permit, today) {
  const stored = String(permit?.status ?? "").toUpperCase();
  const base = { daysLeft: null, daysOverdue: 0, noValidTo: false, detail: "" };

  if (stored === "CLOSED" || stored === "CANCELED") {
    return { ...base, key: stored, label: STATUS_TEXT[stored] };
  }
  if (stored !== "OPEN") return { ...base, key: "OTHER", label: STATUS_TEXT.OTHER };

  const left = daysBetween(today, permit.valid_to);
  if (left === null) {
    // An open permit with no (or an unreadable) end date: shown as open, with a warning.
    return { ...base, key: "OPEN", label: STATUS_TEXT.OPEN, noValidTo: true, detail: "No end date" };
  }
  if (left < 0) {
    return { ...base, key: "OVERDUE", label: STATUS_TEXT.OVERDUE, daysOverdue: -left, detail: `${plural(-left, "day")} overdue` };
  }
  if (left <= EXPIRING_DAYS) {
    return {
      ...base,
      key: "EXPIRING",
      label: STATUS_TEXT.EXPIRING,
      daysLeft: left,
      detail: left === 0 ? "Ends today" : `${plural(left, "day")} left`,
    };
  }
  return { ...base, key: "OPEN", label: STATUS_TEXT.OPEN, daysLeft: left, detail: `${plural(left, "day")} left` };
}

// "Active / Open" on the dashboard = Open + Expiring soon + Overdue.
export const isActiveKey = (key) => key === "OPEN" || key === "EXPIRING" || key === "OVERDUE";

// Filter values used in the address (?status=...).
export const STATUS_FILTERS = [
  { value: "active", label: "Active (open, expiring, overdue)" },
  { value: "open", label: "Open" },
  { value: "expiring", label: "Expiring soon" },
  { value: "overdue", label: "Overdue" },
  { value: "closed", label: "Closed" },
  { value: "canceled", label: "Canceled" },
];

export function matchesStatusFilter(key, filter) {
  if (!filter) return true;
  if (filter === "active") return isActiveKey(key);
  return key.toLowerCase() === filter;
}
