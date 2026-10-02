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
const LIST_LIMIT = 8;

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

  // ---- Text for the "Copy summary" button ----------------------------
  const lines = [];
  const todayLabel = dayLabel(today, 0);
  lines.push(`Permit status, ${todayLabel.full} ${today.slice(0, 4)}`);
  lines.push(
    `Total ${permits.length} | Open ${openTotal} | Expiring soon ${expiring} | Overdue ${overdue}`
  );
  const listOf = (status, label, fmt) => {
    const rows = permits.filter((p) => p.displayStatus === status);
    if (rows.length === 0) return;
    lines.push("");
    lines.push(`${label} (${rows.length}):`);
    rows.slice(0, LIST_LIMIT).forEach((p) => lines.push(`- ${fmt(p)}`));
    if (rows.length > LIST_LIMIT) lines.push(`- +${rows.length - LIST_LIMIT} more`);
  };
  const who = (p) => namesOf(p.holder)[0] || namesOf(p.applicant)[0] || "no holder";
  listOf(
    "OVERDUE",
    "Overdue",
    (p) =>
      `${p.reference || "-"} | ${who(p)}${
        typeof p.daysRemaining === "number" && p.daysRemaining < 0
          ? ` | ${Math.abs(p.daysRemaining)}d late`
          : ""
      }`
  );
  listOf(
    "EXPIRING_SOON",
    "Expiring within 3 days",
    (p) =>
      `${p.reference || "-"} | ${who(p)} | ${
        p.daysRemaining === 0 ? "today" : `${p.daysRemaining}d left`
      }`
  );
  lines.push("");
  lines.push(
    `Next ${FORECAST_DAYS} days: ${forecastTotal} ${plural(forecastTotal, "permit expires", "permits expire")}` +
      (busiest.count > 0 ? ` (busiest ${busiest.full}: ${busiest.count})` : "")
  );

  return {
    tone,
    headline,
    sub: subParts.join(" · "),
    people,
    forecast: { days, total: forecastTotal, busiest },
    summaryText: lines.join("\n"),
  };
}
