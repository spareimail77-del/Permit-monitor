import { createClient } from "@supabase/supabase-js";

// The ADMIN client: uses SUPABASE_SERVICE_ROLE_KEY, which bypasses every database
// rule. Server only (API routes and server pages). Never import this file from a
// "use client" file, and never name the variable NEXT_PUBLIC_.
// Always check the caller's permission first (see lib/adminAuth.js).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
