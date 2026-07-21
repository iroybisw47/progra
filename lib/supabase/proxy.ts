import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getClaims — any
  // logic that reads cookies in between can break session refresh.
  //
  // getClaims verifies the JWT locally via Web Crypto when the Supabase project
  // uses asymmetric signing keys — no network hop on every navigation (getUser
  // hit the Auth server each request). Expired tokens still refresh first, and
  // on a legacy symmetric secret it falls back to server-side validation.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
