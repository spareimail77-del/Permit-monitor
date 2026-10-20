import { createClient } from "./supabase/server";

// The signed-in person's Supabase client (their role decides what the database
// lets them read and write). Kept under this name so pages stay short.
export function getSupabase() {
  return createClient();
}

// How many permits use each dropdown value (permits in the trash do not count).
// Returns { area: { "CCS": 12, ... }, permit_type: {...}, ..., certificate: {...} }.
// Keys are UPPER CASE. If it cannot be read, the counts are simply empty.
const USAGE_COLUMNS = ["area", "permit_type", "applicant", "holder", "issuer", "controller"];

export async function fetchUsage(supabase) {
  const usage = { area: {}, permit_type: {}, certificate: {}, applicant: {}, holder: {}, issuer: {}, controller: {} };
  const { data, error } = await supabase
    .from("permits")
    .select("area, permit_type, applicant, holder, issuer, controller, certificates")
    .is("deleted_at", null)
    .limit(10000);
  if (error) return usage;
  const bump = (list, raw) => {
    const key = String(raw ?? "").trim().toUpperCase();
    if (key) usage[list][key] = (usage[list][key] || 0) + 1;
  };
  for (const p of data || []) {
    for (const col of USAGE_COLUMNS) bump(col, p[col]);
    const certs = Array.isArray(p.certificates) ? p.certificates : [];
    for (const c of certs) bump("certificate", typeof c === "string" ? c : c?.name);
  }
  return usage;
}

export const usageOf = (usage, list, value) => usage?.[list]?.[String(value ?? "").trim().toUpperCase()] || 0;

// The dropdown lists of the permit form: { area: [...], permit_type: [...], ... }.
// The most used value comes first; values used equally keep their normal order.
export async function fetchOptions(supabase) {
  const lists = { area: [], permit_type: [], certificate: [], applicant: [], holder: [], issuer: [], controller: [] };
  const { data, error } = await supabase
    .from("permit_options")
    .select("list, value")
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("value", { ascending: true })
    .limit(2000);
  if (error) return { lists, error };
  for (const o of data || []) if (lists[o.list]) lists[o.list].push(o.value);

  const usage = await fetchUsage(supabase);
  for (const key of Object.keys(lists)) {
    lists[key] = lists[key]
      .map((value, index) => ({ value, index, used: usageOf(usage, key, value) }))
      .sort((a, b) => b.used - a.used || a.index - b.index)
      .map((x) => x.value);
  }
  return { lists, error: null };
}
