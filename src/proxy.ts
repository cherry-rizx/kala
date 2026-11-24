import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  // Memanggil getUser memastikan session disegarkan dan cookie-nya ikut terkirim
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pengguna yang sudah login tidak perlu melihat form login lagi.
  if (user && request.nextUrl.pathname === "/login") {
    const tujuan = request.nextUrl.clone();
    tujuan.pathname = user.app_metadata?.role === "admin" ? "/admin" : "/booking";
    const redirect = NextResponse.redirect(tujuan);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhook).*)"],
};