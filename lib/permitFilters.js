import { STATUS_FILTERS, matchesStatusFilter } from "./status";

// The permit list and the Excel export use the SAME filters, so "Export" gives
// exactly the rows the list shows. `get(name)` returns the text of one address
// parameter (or "" / null when it is missing).
//
//   month = "2026-10"  -> permits whose Valid from date is in that month (Oman dates are
//                         stored as plain YYYY-MM-DD, so no time zone maths is needed)
//   files = "has"|"none" -> permits with / without attached files
// Rows must carry `.st` (computed status) and, for the files filter, `.fileCount`.

export const FILTER_NAMES = ["q", "status", "area", "type", "applicant", "holder", "month", "files"];

const clean = (v) => String(v ?? "").trim().slice(0, 80);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthLabel(value) {
  if (!MONTH_RE.test(String(value))) return String(value || "");
  const [y, m] = value.split("-");
  return `${MONTH_NAMES[+m - 1]} ${y}`;
}

// "2026-10-05" -> "2026-10" ("" when the date is missing or unreadable).
export function monthOf(iso) {
  const m = /^(\d{4}-(0[1-9]|1[0-2]))-\d{2}$/.exec(String(iso ?? ""));
  return m ? m[1] : "";
}

export function parseFilters(get) {
  const status = clean(get("status"));
  const month = clean(get("month"));
  const files = clean(get("files"));
  return {
    q: clean(get("q")),
    status: STATUS_FILTERS.some((s) => s.value === status) ? status : "",
    area: clean(get("area")),
    type: clean(get("type")),
    applicant: clean(get("applicant")),
    holder: clean(get("holder")),
    month: MONTH_RE.test(month) ? month : "",
    files: files === "has" || files === "none" ? files : "",
  };
}

export const hasFilters = (f) => FILTER_NAMES.some((n) => Boolean(f[n]));

// The filters as an address query ("status=overdue&area=CCS"), without empty ones.
export function filtersToQuery(f) {
  const params = new URLSearchParams();
  for (const n of FILTER_NAMES) if (f[n]) params.set(n, f[n]);
  return params.toString();
}

// permits: rows that already carry `.st` (the computed status from lib/status.js).
export function filterPermits(permits, f) {
  const q = f.q.toLowerCase();
  return permits.filter(
    (r) =>
      matchesStatusFilter(r.st.key, f.status) &&
      (!f.area || r.area === f.area) &&
      (!f.type || r.permit_type === f.type) &&
      (!f.applicant || r.applicant === f.applicant) &&
      (!f.holder || r.holder === f.holder) &&
      (!f.month || monthOf(r.valid_from) === f.month) &&
      // fileCount is undefined when the files could not be read: then do not filter on it.
      (!f.files || r.fileCount === undefined || (f.files === "has" ? r.fileCount > 0 : r.fileCount === 0)) &&
      (!q || [r.reference, r.location, r.applicant, r.holder].some((v) => String(v ?? "").toLowerCase().includes(q)))
  );
}
