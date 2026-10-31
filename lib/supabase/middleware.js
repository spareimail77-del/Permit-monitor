import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { can, requiredPermissionFor } from "../permissions";
import { getCurrentUser } from "./user";
import { CACHE_COOKIE, CACHE_HEADER, CACHE_SECONDS, cacheSecret, readNote, signNote } from "../sessionCache";

// Everyone must be signed in to see anything on the site, except these.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/register",
  "/api/auth/register",
  "/forgot-password",
  "/api/auth/forgot",
];

// While a person must change a temporary password, only these are reachable.
const ALLOWED_WHEN_FORCED = ["/change-password", "/api/auth/change-password", "/api/auth/logout"];

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
  // Never trust this header from the outside: only this function may set it (below).
  request.headers.delete(CACHE_HEADER);
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

  // Who is this, and is the account still active? Answered from the signed note while it
  // is fresh (lib/sessionCache.js); otherwise ONE small profile lookup, then a new note.
  const secret = cacheSecret();
  const note = await readNote(request.cookies.get(CACHE_COOKIE)?.value, secret);
  const cachedOk = note && note.id === user.id;
  let profile;
  let fresh = false;
  if (cachedOk) {
    profile = { role: note.role, status: "active", must_change_password: false };
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("staff_id, display_name, role, status, must_change_password")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
    fresh = true;
  }

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

  // A temporary password (set by Root) must be replaced before anything else.
  if (profile.must_change_password && !matches(ALLOWED_WHEN_FORCED, pathname)) {
    if (isApi) {
      return carryCookies(
        NextResponse.json({ error: "You must change your password first.", code: "must_change_password" }, { status: 403 }),
        response
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "";
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

  // Allowed through. Pass the signed note on to the page (so it need not ask the database
  // again), and keep it in a cookie for the next requests. A person who must still change
  // a temporary password is never cached, so the change takes effect at once.
  let token = cachedOk ? request.cookies.get(CACHE_COOKIE).value : null;
  if (!token && fresh && secret && !profile.must_change_password) {
    token = await signNote(
      { id: user.id, staffId: profile.staff_id, name: profile.display_name || profile.staff_id, role: profile.role },
      secret
    );
  }
  if (!token) return response;

  request.headers.set(CACHE_HEADER, token);
  const passed = carryCookies(NextResponse.next({ request: { headers: new Headers(request.headers) } }), response);
  if (fresh) {
    passed.cookies.set(CACHE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CACHE_SECONDS,
    });
  }
  return passed;
}
