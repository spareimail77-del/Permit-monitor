import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Reads the session from cookies. Session refresh (writing new
// cookies) is handled centrally in middleware.js — a Server Component
// can't set cookies on the outgoing response, so setAll here is a
// no-op wrapped in try/catch, matching Supabase's documented pattern.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (err) {
            // Called from a Server Component during render — expected,
            // middleware.js is what actually refreshes the session.
          }
        },
      },
    }
  );
}
