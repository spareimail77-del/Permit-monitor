import { STATUS_FILTERS, matchesStatusFilter } from "./status";

// The permit list and the Excel export use the SAME filters, so "Export" gives
// exactly the rows the list shows. `get(name)` returns the text of one address
// parameter (or "" / null when it is missing).

export const FILTER_NAMES = ["q", "status", "area", "type", "applicant", "holder"];

const clean = (v) => String(v ?? "").trim().slice(0, 80);

export function parseFilters(get) {
  const status = clean(get("status"));
  return {
    q: clean(get("q")),
    status: STATUS_FILTERS.some((s) => s.value === status) ? status : "",
    area: clean(get("area")),
    type: clean(get("type")),
    applicant: clean(get("applicant")),
    holder: clean(get("holder")),
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
      (!q || [r.reference, r.location, r.applicant, r.holder].some((v) => String(v ?? "").toLowerCase().includes(q)))
  );
}
