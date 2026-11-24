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
  const base = { daysLeft: null, daysOverdue: 0, noValidTo: false, detail: "", missing: false };

  if (stored === "CLOSED" || stored === "CANCELED") {
    // Paper copy missing is only a tag on a CLOSED permit: the status itself stays Closed, so
    // every count and filter keeps treating it as Closed.
    return { ...base, key: stored, label: STATUS_TEXT[stored], missing: stored === "CLOSED" && Boolean(permit?.paper_missing) };
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

// ---- Multi-select status filter -------------------------------------------------
// The address holds a comma list: ?status=open,closed  (also the old single values,
// and "active" = open + expiring + overdue). Nothing selected = All statuses.
// Selecting every status is the same as All, so it is stored as "".
const CHIP_ORDER = ["open", "expiring", "overdue", "closed", "canceled"];

// "open,closed" / "active" / "overdue" -> ["open", "closed"] (valid, no repeats, fixed order).
// [] means "no status filter".
export function parseStatusList(raw) {
  const picked = new Set();
  for (const part of String(raw ?? "").toLowerCase().split(",")) {
    const v = part.trim();
    if (v === "active") ["open", "expiring", "overdue"].forEach((k) => picked.add(k));
    else if (CHIP_ORDER.includes(v)) picked.add(v);
  }
  const list = CHIP_ORDER.filter((k) => picked.has(k));
  return list.length === CHIP_ORDER.length ? [] : list;
}

// The clean text stored in the filters and the address ("" = All).
export const statusToString = (list) => parseStatusList((list || []).join(",")).join(",");

// Click a chip: add it if it is not selected, remove it if it is.
export function toggleStatus(current, value) {
  const list = parseStatusList(current);
  const next = list.includes(value) ? list.filter((k) => k !== value) : [...list, value];
  return statusToString(next);
}

// "open,closed" -> "Open + Closed"
export function statusLabel(filter) {
  return parseStatusList(filter)
    .map((k) => STATUS_TEXT[k.toUpperCase()])
    .join(" + ");
}

export function matchesStatusFilter(key, filter) {
  const list = parseStatusList(filter);
  return list.length === 0 || list.includes(String(key).toLowerCase());
}
