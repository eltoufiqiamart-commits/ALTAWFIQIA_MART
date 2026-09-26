import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Session refresh + coarse route protection. Every protected page/action also
 * performs its own server-side authorization (defense in depth); middleware
 * alone is never the security boundary.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPrivate = pathname.startsWith("/account") || pathname.startsWith("/checkout");
  const isAdmin = pathname.startsWith("/admin");

  if ((isPrivate || isAdmin) && !user) {
    const redirect = new URL("/login", request.url);
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  // Role check for admin happens again (with profile/permission data) in the
  // admin layout. Block obvious non-admins here too.
  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();
    const adminRoles = [
      "super_admin",
      "product_manager",
      "order_manager",
      "content_manager",
      "customer_support",
    ];
    if (!profile || !profile.is_active || !adminRoles.includes(profile.role)) {
      return NextResponse.redirect(new URL("/403", request.url));
    }
  }

  if (isPrivate || isAdmin) {
    response.headers.set("x-robots-tag", "noindex, nofollow");
    response.headers.set("cache-control", "no-store");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand|hero|robots.txt|sitemap.xml|sitemap/|manifest.webmanifest).*)",
  ],
};
