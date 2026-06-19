import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/auth/callback'];
const PUBLIC_API_PREFIXES = ['/api/webhooks', '/api/jobs/process-document'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const isPublic =
    PUBLIC_ROUTES.some((route) => pathname === route) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && !isPublic && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as string | undefined;

    if (pathname.startsWith('/candidate') && role !== 'candidate' && role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (pathname.startsWith('/employer') && role !== 'employer' && role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (pathname === '/login' || pathname === '/register') {
      const dashboard = role === 'employer' ? '/employer' : role === 'admin' ? '/admin' : '/candidate';
      return NextResponse.redirect(new URL(dashboard, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
