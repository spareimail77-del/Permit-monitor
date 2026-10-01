// The only status calculations this website performs are EXPIRING_SOON
// and OVERDUE (see computeDisplayStatus below). Every other status
// (OPEN, CLOSED, CANCELED/CANCELLED) is taken as-is from the Excel
// Status column, which your VBA already maintains.
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
 * Display status for one permit.
 *
 * OVERDUE = the permit is still open but its Valid To date has passed.
 * It comes from two places, and both end up as OVERDUE (the site never
 * shows an "Expired" status):
 *   - Excel says OPEN and Valid To is before today (the site works this
 *     out itself, in Oman time, so it is right even if the file was
 *     uploaded days ago).
 *   - Excel says EXPIRED (or OVERDUE). In this workbook "Expired" only
 *     means "still open, past its closing date" - not closed.
 *
 * OPEN -> EXPIRING_SOON when 0-3 days remain until Valid To.
 * Every other Excel status passes through unchanged.
 *
 * Returns { displayStatus, daysRemaining, excelMismatch }.
 * daysRemaining is negative for overdue permits (-2 = 2 days overdue).
 * excelMismatch is true when Excel says EXPIRED but Valid To is still in
 * the future - the date wins, and the detail page warns about it.
 */
export function computeDisplayStatus(permit, todayISO) {
  let excelStatus = String(permit.excelStatus || "").toUpperCase();
  if (excelStatus === "OVERDUE") excelStatus = "EXPIRED";
  const markedExpired = excelStatus === "EXPIRED";

  if (excelStatus !== "OPEN" && !markedExpired) {
    return {
      displayStatus: excelStatus || "UNKNOWN",
      daysRemaining: null,
      excelMismatch: false,
    };
  }

  if (!permit.validTo) {
    // No date to count from. Excel EXPIRED is still overdue; an OPEN
    // permit is left as OPEN rather than guessing.
    return {
      displayStatus: markedExpired ? "OVERDUE" : "OPEN",
      daysRemaining: null,
      excelMismatch: false,
    };
  }

  const daysRemaining = daysBetween(todayISO, permit.validTo);

  if (daysRemaining < 0 || (markedExpired && daysRemaining === 0)) {
    return { displayStatus: "OVERDUE", daysRemaining, excelMismatch: false };
  }

  // Excel says EXPIRED but the date is still ahead: trust the date.
  const excelMismatch = markedExpired;

  if (daysRemaining <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return { displayStatus: "EXPIRING_SOON", daysRemaining, excelMismatch };
  }
  return { displayStatus: "OPEN", daysRemaining, excelMismatch };
}

// Short text for the "days" cell / badge, e.g. "3d left", "2d overdue".
export function daysText(permit) {
  const d = permit.daysRemaining;
  if (permit.displayStatus === "OVERDUE") {
    return typeof d === "number" && d < 0 ? `${Math.abs(d)}d overdue` : "Overdue";
  }
  if (typeof d !== "number") return "—";
  return d === 0 ? "Due today" : `${d}d left`;
}
