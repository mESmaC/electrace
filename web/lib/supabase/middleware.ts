import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "./config";

// Routes that require a signed-in user — enforced SERVER-SIDE here against Supabase (the auth source),
// not just by the client-side RequireAuth wrapper (which only redirects after the page has shipped).
// /editor is deliberately ABSENT: anonymous users get the sandbox (localStorage-only, banner explains;
// signup imports their work). Cloud APIs still 401 — the sandbox can't write to anyone's account.
const PROTECTED = ["/projects", "/settings", "/welcome"];
const isProtected = (path: string) => PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

/** Refresh the Supabase session on each request (writes the rotated cookie) AND gate protected routes
 *  against the real session. No-op until Supabase is provisioned. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (!supabaseConfigured) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getUser() validates the token with Supabase (not just decodes a cookie) and rotates the session.
  const { data: { user } } = await supabase.auth.getUser();

  // No valid session + a protected page → bounce to login server-side, before the page renders.
  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
