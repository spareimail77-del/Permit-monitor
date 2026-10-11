import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// The Supabase client for server pages and API routes. It reads the signed-in
// person's session from cookies, so the database rules (row level security)
// apply to that person. Refreshing the session (writing new cookies) is done in
// middleware.js; a server page cannot set cookies, so setAll is allowed to fail
// quietly here (Supabase's documented pattern).
//
// "cache: no-store" on every request: Next.js would otherwise remember database
// answers, and a saved permit could be missing from the list.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called while a page is rendering: expected, middleware refreshes the session.
        }
      },
    },
  });
}
