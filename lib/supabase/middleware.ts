import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define public paths that don't require authentication
  const publicPaths = [
    "/",
    "/login",
    "/auth/callback",
    "/api/auth/signup",
    "/api/auth/oauth",
    "/api/business-card",
  ];

  // Define protected paths that require authentication
  const protectedPaths = [
    "/profile",
    "/directory",
    "/matches",
    "/api/profile",
    "/api/account",
    "/api/profile-intelligence",
  ];

  const currentPath = request.nextUrl.pathname;

  // Check if current path is public
  const isPublicPath = publicPaths.some(
    (path) => currentPath === path || currentPath.startsWith(path)
  );

  // Check if current path is protected
  const isProtectedPath = protectedPaths.some(
    (path) => currentPath === path || currentPath.startsWith(path)
  );

  // Redirect authenticated users away from login page only
  if (user && currentPath === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users from protected routes to login
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the intended destination for after login
    url.searchParams.set("redirectTo", currentPath);
    return NextResponse.redirect(url);
  }

  // Allow access to public paths or if user is authenticated
  if (isPublicPath || user) {
    return supabaseResponse;
  }

  // Default: redirect to login for any other unauthenticated access
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", currentPath);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object

  return supabaseResponse;
}
