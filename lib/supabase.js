import { createClient } from "@supabase/supabase-js";

// STEP A (no login yet): the site talks to Supabase with the public (anon) key.
// Step B adds login and replaces this with a signed-in client, and the open
// policies in supabase/01-permits.sql are removed.
//
// "cache: no-store" on every request: Next.js would otherwise remember
// database answers, and a saved permit could be missing from the list.
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
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
