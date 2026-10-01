import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { can, requiredPermissionFor } from "../permissions";
import { getCurrentUser } from "./user";

// Everyone must be signed in to see anything on the site.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/api/auth/register",
  "/api/auth/forgot",
];

// Which role may open which URL is defined in lib/permissions.js
// (requiredPermissionFor). This file is the enforcement point; pages and
// API routes re-check independently, so the lock can't be bypassed by
// calling an API directly.

// Activity log (step 24): a visit is written only when the person opens a
// different page, or when their last write is older than this.
const LOG_MIN_GAP_MS = 3 * 60 * 1000;

function shouldLogVisit(request, isApi, pathname, profile) {
  if (isApi || request.method !== "GET") return false;
  const h = request.headers;
  // Link prefetches are not real visits.
  if (
    h.get("next-router-prefetch") ||
    h.get("next-router-segment-prefetch") ||
    h.get("x-middleware-prefetch") ||
    h.get("purpose") === "prefetch" ||
    (h.get("sec-purpose") || "").includes("prefetch")
  ) {
    return false;
  }
  if (profile.last_path !== pathname.slice(0, 200)) return true;
  const last = profile.last_seen_at ? Date.parse(profile.last_seen_at) : 0;
  return Date.now() - last > LOG_MIN_GAP_MS;
}

function matches(paths, pathname) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Copies any session-refresh cookies Supabase queued onto `from`
// across to a brand-new response (a redirect or a JSON error),
// so the browser's session cookie stays in sync even on those paths.
function carryCookies(to, from) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function updateSession(request, event) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add logic between createServerClient and getCurrentUser() — this
  // call is what actually refreshes an expiring session. It avoids a network
  // round trip to Supabase Auth when it can (see lib/supabase/user.js).
  const user = await getCurrentUser(supabase);

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // /api/auth/me is used by the header to show who's signed in; it
  // does its own auth check and returns JSON either way.
  if (pathname === "/api/auth/me") return response;

  if (!user) {
    if (matches(PUBLIC_PATHS, pathname)) return response;

    if (isApi) {
      return carryCookies(
        NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
        response
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return carryCookies(NextResponse.redirect(url), response);
  }

  // Signed in but on /login — send them on to the dashboard.
  if (matches(PUBLIC_PATHS, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return carryCookies(NextResponse.redirect(url), response);
  }

  // One small profile lookup per request: it checks the account is
  // still active (pending/disabled accounts are signed out at once)
  // and gives the role for the route rules below.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, must_change_password, last_seen_at, last_path")
    .eq("id", user.id)
    .single();

  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    const reason = profile?.status === "pending" ? "pending" : "disabled";
    if (isApi) {
      return carryCookies(
        NextResponse.json({ error: `Account ${reason}.` }, { status: 403 }),
        response
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?reason=${reason}`;
    return carryCookies(NextResponse.redirect(url), response);
  }

  // A temporary password (set by an admin) must be replaced before
  // anything else on the site can be used.
  if (
    profile.must_change_password &&
    pathname !== "/change-password" &&
    pathname !== "/api/auth/change-password"
  ) {
    if (isApi) {
      return carryCookies(
        NextResponse.json({ error: "Password change required." }, { status: 403 }),
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
      return carryCookies(
        NextResponse.json(
          { error: "Not authorized for this action." },
          { status: 403 }
        ),
        response
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return carryCookies(NextResponse.redirect(url), response);
  }

  // Record the visit in the background (never delays or breaks the page).
  if (shouldLogVisit(request, isApi, pathname, profile)) {
    const logged = Promise.resolve(
      supabase.rpc("touch_activity", { p_path: pathname.slice(0, 200) })
    ).catch(() => {});
    if (event && typeof event.waitUntil === "function") event.waitUntil(logged);
  }

  return response;
}
