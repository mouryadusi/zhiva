import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase session cookie on every request so server
// components always see an up-to-date auth state, and redirects
// unauthenticated users away from the private app shell. This is a
// convenience redirect only — the real authorization boundary is RLS
// on every table, enforced server-side regardless of what this does.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPrivateRoute = request.nextUrl.pathname.startsWith('/home') ||
    request.nextUrl.pathname.startsWith('/money') ||
    request.nextUrl.pathname.startsWith('/transactions') ||
    request.nextUrl.pathname.startsWith('/budgets') ||
    request.nextUrl.pathname.startsWith('/goals') ||
    request.nextUrl.pathname.startsWith('/assistant') ||
    request.nextUrl.pathname.startsWith('/insights') ||
    request.nextUrl.pathname.startsWith('/tasks') ||
    request.nextUrl.pathname.startsWith('/journal') ||
    request.nextUrl.pathname.startsWith('/recurring') ||
    request.nextUrl.pathname.startsWith('/reports') ||
    request.nextUrl.pathname.startsWith('/net-worth') ||
    request.nextUrl.pathname.startsWith('/household') ||
    request.nextUrl.pathname.startsWith('/calendar') ||
    request.nextUrl.pathname.startsWith('/you');

  if (isPrivateRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
