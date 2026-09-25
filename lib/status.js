// The ONLY status calculation this website performs. Every other
// status (OPEN, CLOSED, EXPIRED, CANCELED/CANCELLED) is taken as-is
// from the Excel Status column, which your VBA already maintains.
//
// Timezone: Asia/Muscat (Oman, no DST). The permit site/facility is
// in Salalah, Oman, so "today" for the 3-day boundary is always
// calculated in that local calendar day — not the server's own
// timezone (Vercel's servers run in UTC by default, which would
// silently shift the boundary by a few hours otherwise).

const EXPIRING_SOON_THRESHOLD_DAYS = 3;
const TIMEZONE = "Asia/Muscat";

// Today's date, as a "YYYY-MM-DD" string, in Asia/Muscat.
export function todayInMuscat() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function toDateNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// Whole calendar days from `fromISO` to `toISO` (can be negative).
export function daysBetween(fromISO, toISO) {
  const ONE_DAY_MS = 86400000;
  return Math.round((toDateNumber(toISO) - toDateNumber(fromISO)) / ONE_DAY_MS);
}

/**
 * Adds exactly one computed field on top of the Excel status:
 * OPEN -> EXPIRING_SOON when 0-3 days remain until Valid To.
 * Every other Excel status passes through unchanged.
 */
export function computeDisplayStatus(permit, todayISO) {
  const excelStatus = permit.excelStatus || "";

  if (excelStatus !== "OPEN") {
    return { displayStatus: excelStatus || "UNKNOWN", daysRemaining: null };
  }

  if (!permit.validTo) {
    // Can't compute a boundary without a Valid To date — leave the
    // Excel status untouched rather than guessing.
    return { displayStatus: "OPEN", daysRemaining: null };
  }

  const daysRemaining = daysBetween(todayISO, permit.validTo);

  if (daysRemaining >= 0 && daysRemaining <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return { displayStatus: "EXPIRING_SOON", daysRemaining };
  }

  return { displayStatus: "OPEN", daysRemaining };
}
