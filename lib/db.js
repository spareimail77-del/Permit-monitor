import { createClient } from "./supabase/server";

// The signed-in person's Supabase client (their role decides what the database
// lets them read and write). Kept under this name so pages stay short.
export function getSupabase() {
  return createClient();
}

// The dropdown lists of the permit form: { area: [...], permit_type: [...], ... }
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
  return { lists, error: null };
}
