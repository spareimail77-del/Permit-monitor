import { createBrowserClient } from "@supabase/ssr";

// One client per call — cheap, and avoids sharing state across
// requests. Used only from "use client" components (login form,
// sign-out button).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
