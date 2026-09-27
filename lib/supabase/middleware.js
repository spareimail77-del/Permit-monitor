import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Everyone must be signed in to see anything on the site.
const PUBLIC_PATHS = ["/login"];

// Signed in is not enough for these — the profile's role must be
// 'admin'. This is the enforcement point for "only HSE admins can
// upload"; the /api/upload route also checks independently, so the
// lock can't be bypassed by calling the API directly.
const ADMIN_PATHS = ["/upload", "/api/upload"];

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

export async function updateSession(request) {
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

  // Do not add logic between createServerClient and getUser() — this
  // call is what actually refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (matches(ADMIN_PATHS, pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      if (isApi) {
        return carryCookies(
          NextResponse.json(
            { error: "Not authorized. Admin role required." },
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
  }

  return response;
}
