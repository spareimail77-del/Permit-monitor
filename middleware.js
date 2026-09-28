import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request, event) {
  return await updateSession(request, event);
}

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static assets,
    // so every page and API route is covered by default.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
