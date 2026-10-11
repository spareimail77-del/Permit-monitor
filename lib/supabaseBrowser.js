"use client";

import { createClient } from "@supabase/supabase-js";

// Browser-side client, used only to send files straight to storage (the
// Vercel free plan refuses request bodies over about 4.5 MB). Uses the public
// anon key, like every browser client. Step B ties this to the signed-in person.
let client;
export function getBrowserSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
}
