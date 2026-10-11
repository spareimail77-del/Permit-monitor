import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { can, requiredPermissionFor } from "../permissions";
import { getCurrentUser } from "./user";

// Everyone must be signed in to see anything on the site, except these.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

function matches(paths, pathname) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Copies any session-refresh cookies Supabase queued onto `from` across to a
// brand-new response (a redirect or a JSON error), so the browser's session
// cookie stays in sync even on those paths.
function carryCookies(to, from) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

// Runs before every page and API route: refreshes the session, sends signed-out
// people to /login, signs out accounts that are not active, and checks the
// role's permission for the URL. Pages and routes check again on their own, so
// the lock cannot be bypassed by calling an API directly.
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not add logic between createServerClient and getCurrentUser(): this call
  // is what actually refreshes an expiring session.
  const user = await getCurrentUser(supabase);

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!user) {
    if (matches(PUBLIC_PATHS, pathname)) return response;
    if (isApi) {
      return carryCookies(NextResponse.json({ error: "Not authenticated." }, { status: 401 }), response);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return carryCookies(NextResponse.redirect(url), response);
  }

  // Signed in but on /login: send them on to the home page.
  if (matches(PUBLIC_PATHS, pathname) && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return carryCookies(NextResponse.redirect(url), response);
  }

  // One small profile lookup per request: is the account still active, and
  // which role does it have?
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();

  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    const reason = profile?.status === "disabled" ? "disabled" : "pending";
    if (isApi) {
      return carryCookies(NextResponse.json({ error: `Account ${reason}.` }, { status: 403 }), response);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?reason=${reason}`;
    return carryCookies(NextResponse.redirect(url), response);
  }

  const required = requiredPermissionFor(pathname);
  if (required && !can(profile.role, required)) {
    if (isApi) {
      return carryCookies(NextResponse.json({ error: "Not authorized for this action." }, { status: 403 }), response);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return carryCookies(NextResponse.redirect(url), response);
  }

  return response;
}
