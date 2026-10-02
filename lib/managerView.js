// Numbers for the Manager dashboard. Pure functions: they only reshape the
// permits the dashboard has already loaded, so they cost no extra reads.
//
// A "person" is a name in the Holder or Applicant column. A permit counts
// once for every distinct person on it (same person as holder and applicant
// counts once).

import { normName } from "./people";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FORECAST_DAYS = 14;
const SUMMARY_URL = "swws-permit-monitor.vercel.app";

function namesOf(cell) {
  return String(cell ?? "")
    .split(/[,/&;\n]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function dayLabel(iso, offset) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return {
    wd: WD[d.getUTCDay()],
    day: d.getUTCDate(),
    full: `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`,
  };
}

const plural = (n, one, many) => (n === 1 ? one : many);

export function buildManagerView(permits, today) {
  const isOpen = (p) =>
    p.displayStatus === "OPEN" ||
    p.displayStatus === "EXPIRING_SOON" ||
    p.displayStatus === "OVERDUE";

  // ---- People board --------------------------------------------------
  const board = new Map();
  for (const p of permits) {
    if (!isOpen(p)) continue;
    const seen = new Set();
    for (const original of [...namesOf(p.holder), ...namesOf(p.applicant)]) {
      const key = normName(original);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      let row = board.get(key);
      if (!row) {
        row = { key, spellings: new Map(), active: 0, expiring: 0, overdue: 0, oldest: 0 };
        board.set(key, row);
      }
      row.spellings.set(original, (row.spellings.get(original) || 0) + 1);
      row.active++;
      if (p.displayStatus === "EXPIRING_SOON") row.expiring++;
      if (p.displayStatus === "OVERDUE") {
        row.overdue++;
        if (typeof p.daysRemaining === "number" && p.daysRemaining < 0) {
          row.oldest = Math.max(row.oldest, Math.abs(p.daysRemaining));
        }
      }
    }
  }
  const people = [...board.values()]
    .map((r) => ({
      name: [...r.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      active: r.active,
      expiring: r.expiring,
      overdue: r.overdue,
      oldest: r.oldest,
    }))
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        b.expiring - a.expiring ||
        b.active - a.active ||
        a.name.localeCompare(b.name)
    );

  // ---- Next 14 days --------------------------------------------------
  const days = Array.from({ length: FORECAST_DAYS }, (_, i) => ({
    ...dayLabel(today, i),
    offset: i,
    count: 0,
  }));
  for (const p of permits) {
    if (p.displayStatus !== "OPEN" && p.displayStatus !== "EXPIRING_SOON") continue;
    if (typeof p.daysRemaining !== "number") continue;
    if (p.daysRemaining >= 0 && p.daysRemaining < FORECAST_DAYS) days[p.daysRemaining].count++;
  }
  const forecastTotal = days.reduce((s, d) => s + d.count, 0);
  const busiest = days.reduce((best, d) => (d.count > best.count ? d : best), days[0]);

  // ---- Headline ------------------------------------------------------
  const count = (s) => permits.filter((p) => p.displayStatus === s).length;
  const overdue = count("OVERDUE");
  const expiring = count("EXPIRING_SOON");
  const openTotal = count("OPEN") + expiring + overdue;

  let tone = "ok";
  let headline = "All open permits are on track";
  if (overdue > 0) {
    tone = "overdue";
    headline = `${overdue} ${plural(overdue, "permit is", "permits are")} overdue`;
    if (expiring > 0) headline += `, ${expiring} expiring soon`;
  } else if (expiring > 0) {
    tone = "soon";
    headline = `${expiring} ${plural(expiring, "permit is", "permits are")} expiring within 3 days`;
  }

  const withOverdue = people.filter((r) => r.overdue > 0);
  const subParts = [`${openTotal} open of ${permits.length} permits`];
  if (withOverdue.length > 0) {
    const shown = withOverdue.slice(0, 3).map((r) => `${r.name} (${r.overdue})`);
    const more = withOverdue.length - shown.length;
    subParts.push(`Overdue with ${shown.join(", ")}${more > 0 ? ` +${more} more` : ""}`);
  }

  // ---- Text for the "Copy summary" button (HSE) ----------------------
  // Open matches the "Active / Open" card on the dashboard (it includes the
  // Expiring Soon and Overdue permits, which are listed on their own below).
  const closed = count("CLOSED");
  const summaryText = [
    "\u{1F4CB} Daily Work Permit Update",
    `\u{1F7E2} Open \u2013 ${openTotal}`,
    `\u{1F7E0} Expiring Soon \u2013 ${expiring}`,
    `\u{1F534} Overdue \u2013 ${overdue}`,
    `\u26AB Closed \u2013 ${closed}`,
    `\u{1F517} More details: ${SUMMARY_URL}`,
  ].join("\n");

  return {
    tone,
    headline,
    sub: subParts.join(" · "),
    people,
    forecast: { days, total: forecastTotal, busiest },
    summaryText,
  };
}
