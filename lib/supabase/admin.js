import { createClient } from "@supabase/supabase-js";

// Server-only client that uses the Supabase service_role key. It bypasses
// Row Level Security, so it must NEVER be imported from a "use client"
// file or sent to the browser. The key comes from the Vercel environment
// variable SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix, on purpose).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
