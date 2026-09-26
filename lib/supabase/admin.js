import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the service role key, which bypasses Row Level
// Security and can call the Admin API (create/update any user,
// change anyone's email or password directly). Never import this
// file from a "use client" component or expose SUPABASE_SERVICE_ROLE_KEY
// with a NEXT_PUBLIC_ prefix — it must never reach the browser.
//
// Used for:
//  - checking staff-ID availability before signup (bypasses the
//    "read own profile only" RLS policy)
//  - swapping a new account's login email from the real company
//    address (used once, to receive Supabase's free confirmation
//    email) to the permanent synthetic staff-ID address
//  - the forgot-password flow, which needs the same swap trick in
//    reverse so Supabase's free mailer can reach the real address
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel → Project → " +
        "Settings → Environment Variables (Supabase → Project Settings → " +
        "API → service_role key). Server-only — do not prefix with NEXT_PUBLIC_."
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
