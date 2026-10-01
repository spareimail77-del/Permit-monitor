// Pure helpers for the Activity page (step 25): friendly page names,
// sessions, day grouping and the summary numbers. No database or React
// in here, so it is easy to reason about. Oman time is UTC+4 all year.

const OMAN_MS = 4 * 3600 * 1000;
const DAY_MS = 86400000;
export const SESSION_GAP_MS = 30 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const oman = (ms) => new Date(ms + OMAN_MS);

export const dayKey = (ms) => oman(ms).toISOString().slice(0, 10);
export const hourOf = (ms) => oman(ms).getUTCHours();
export const clock = (ms) => `${pad(oman(ms).getUTCHours())}:${pad(oman(ms).getUTCMinutes())}`;

export function exactTime(ms) {
  const d = oman(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${clock(ms)} (Oman time)`;
}

export function dayHeading(key, nowMs) {
  if (key === dayKey(nowMs)) return "Today";
  if (key === dayKey(nowMs - DAY_MS)) return "Yesterday";
  const d = new Date(`${key}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function weekdayShort(key) {
  return WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
}

export function ago(ms, nowMs) {
  const min = Math.floor((nowMs - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export function durationText(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "under 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// path -> { label, icon, type, href }. type drives the filter chips.
export function describePath(path) {
  const p = (path || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const permit = p.match(/^\/permits\/(\d+)$/);
  if (permit) return { label: `Permit #${permit[1]}`, icon: "clipboard", type: "permits", href: p };
  const known = {
    "/": ["Dashboard", "layers", "dashboard"],
    "/permits": ["Permit List", "clipboard", "permits"],
    "/upload": ["Upload data", "archive", "upload"],
    "/admin": ["Admin", "users", "admin"],
    "/admin/users": ["Admin · Users", "users", "admin"],
    "/admin/activity": ["Admin · Activity", "clock", "admin"],
    "/admin/archive": ["Admin · Archive", "archive", "admin"],
    "/admin/password-requests": ["Admin · Password requests", "lock", "admin"],
    "/change-password": ["Change password", "lock", "other"],
    "/profile": ["My profile", "users", "other"],
    "/admin/id-changes": ["Admin · Staff ID changes", "tag", "admin"],
  };
  const hit = known[p];
  if (hit) return { label: hit[0], icon: hit[1], type: hit[2], href: p };
  return { label: p, icon: "tag", type: p.startsWith("/admin") ? "admin" : "other", href: p };
}

// rows: [{ s: staffId, p: path, t: ms }] in any order.
// Same person, less than 30 minutes between visits = one session.
export function buildSessions(rows) {
  const byStaff = new Map();
  for (const r of rows) {
    if (!byStaff.has(r.s)) byStaff.set(r.s, []);
    byStaff.get(r.s).push(r);
  }
  const sessions = [];
  for (const [staff, list] of byStaff) {
    list.sort((a, b) => a.t - b.t);
    let cur = null;
    for (const r of list) {
      if (!cur || r.t - cur.end > SESSION_GAP_MS) {
        cur = { id: `${staff}-${r.t}`, staff, start: r.t, end: r.t, items: [] };
        sessions.push(cur);
      }
      cur.items.push({ t: r.t, path: r.p });
      cur.end = r.t;
    }
  }
  sessions.sort((a, b) => b.end - a.end);
  return sessions;
}

export function groupByDay(sessions) {
  const groups = [];
  for (const s of sessions) {
    const key = dayKey(s.end);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, sessions: [] };
      groups.push(g);
    }
    g.sessions.push(s);
  }
  return groups;
}

export function summarize(rows, nowMs) {
  const today = dayKey(nowMs);
  const people = new Set();
  let views = 0;
  const pages = new Map();
  const hours = new Array(24).fill(0);
  const perDay = new Map();
  for (const r of rows) {
    const k = dayKey(r.t);
    perDay.set(k, (perDay.get(k) || 0) + 1);
    hours[hourOf(r.t)] += 1;
    const label = describePath(r.p).label;
    pages.set(label, (pages.get(label) || 0) + 1);
    if (k === today) {
      views += 1;
      people.add(r.s);
    }
  }
  let topPage = null;
  for (const [label, n] of pages) if (!topPage || n > topPage.n) topPage = { label, n };
  let busy = -1;
  hours.forEach((n, h) => {
    if (n > 0 && (busy < 0 || n > hours[busy])) busy = h;
  });
  // One bar per day from the oldest logged day up to today.
  const days = [];
  if (rows.length) {
    const oldest = Math.min(...rows.map((r) => r.t));
    for (let t = nowMs; dayKey(t) >= dayKey(oldest) && days.length < 14; t -= DAY_MS) {
      const key = dayKey(t);
      days.unshift({ key, n: perDay.get(key) || 0 });
    }
  }
  return {
    peopleToday: people.size,
    viewsToday: views,
    topPage,
    busyHour: busy < 0 ? null : { hour: busy, n: hours[busy] },
    days,
  };
}
