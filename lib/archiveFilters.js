// One place that understands the archive's filters, so the page, the
// "select all matching" route and the export route can never disagree
// about which permits a set of filters matches.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OMAN_OFFSET = "+04:00"; // Asia/Muscat: fixed UTC+4, no daylight saving

export const ARCHIVE_SORTS = {
  archived_desc: { label: "Newest archived first", column: "archived_at", ascending: false },
  archived_asc: { label: "Oldest archived first", column: "archived_at", ascending: true },
  valid_desc: { label: "Valid-to: latest first", column: "valid_to", ascending: false },
  valid_asc: { label: "Valid-to: earliest first", column: "valid_to", ascending: true },
  ref_asc: { label: "Permit no. A-Z", column: "reference", ascending: true },
};
export const DEFAULT_SORT = "archived_desc";

// Real calendar date in YYYY-MM-DD form, or "".
export function cleanDate(value) {
  const v = String(value || "").trim();
  if (!DATE_RE.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10) === v ? v : "";
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cleanText(value) {
  return String(value || "").trim();
}

// Accepts Next's searchParams or a plain object (e.g. a JSON body).
export function parseArchiveFilters(source = {}) {
  const get = (k) => {
    const v = source[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    // Characters with special meaning inside a PostgREST filter are removed.
    q: cleanText(get("q")).replace(/[,()%*\\]/g, " ").trim(),
    area: cleanText(get("area")),
    type: cleanText(get("type")),
    status: cleanText(get("status")),
    from: cleanDate(get("from")), // archived on/after (Oman day)
    to: cleanDate(get("to")), // archived on/before (Oman day)
    vfrom: cleanDate(get("vfrom")), // valid-to on/after
    vto: cleanDate(get("vto")), // valid-to on/before
  };
}

export function parseSort(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return ARCHIVE_SORTS[v] ? v : DEFAULT_SORT;
}

export function hasActiveFilters(f) {
  return Object.values(f).some(Boolean);
}

// Filters as URL params (only the ones that are set).
export function filtersToParams(f, extra = {}) {
  const out = {};
  for (const [k, v] of Object.entries({ ...f, ...extra })) {
    if (v) out[k] = String(v);
  }
  return out;
}

// Start of an Oman calendar day, as a UTC ISO instant.
function omanDayStartUTC(isoDay) {
  return new Date(`${isoDay}T00:00:00${OMAN_OFFSET}`).toISOString();
}

export function applyArchiveFilters(query, f) {
  if (f.q) {
    query = query.or(
      `reference.ilike.%${f.q}%,job_description.ilike.%${f.q}%,holder.ilike.%${f.q}%,area.ilike.%${f.q}%`
    );
  }
  if (f.area) query = query.eq("area", f.area);
  if (f.type) query = query.eq("permit_type", f.type);
  if (f.status) query = query.eq("excel_status", f.status);
  if (f.from) query = query.gte("archived_at", omanDayStartUTC(f.from));
  if (f.to) query = query.lt("archived_at", omanDayStartUTC(addDaysISO(f.to, 1)));
  if (f.vfrom) query = query.gte("valid_to", f.vfrom);
  if (f.vto) query = query.lte("valid_to", f.vto);
  return query;
}

export function applyArchiveSort(query, sortKey) {
  const s = ARCHIVE_SORTS[sortKey] || ARCHIVE_SORTS[DEFAULT_SORT];
  query = query.order(s.column, { ascending: s.ascending, nullsFirst: false });
  // Stable tie-break so paging never repeats or skips a row.
  if (s.column !== "reference") query = query.order("reference", { ascending: true });
  return query;
}

// Quick ranges shown as one-click links above the archive table.
export function archivePresets(todayISO) {
  return [
    { key: "7d", label: "Last 7 days", params: { from: addDaysISO(todayISO, -7) } },
    { key: "30d", label: "Last 30 days", params: { from: addDaysISO(todayISO, -30) } },
    { key: "month", label: "This month", params: { from: `${todayISO.slice(0, 8)}01` } },
    { key: "old90", label: "Older than 90 days", params: { to: addDaysISO(todayISO, -91) } },
  ];
}
