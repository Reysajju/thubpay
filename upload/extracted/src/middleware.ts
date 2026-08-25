import { getToken } from 'next-auth/jwt';
import { type NextRequest, NextResponse } from 'next/server';

// ─── Route classification ────────────────────────────────────────────

const PUBLIC_ROUTES = [
  '/', '/about-us', '/blogs', '/contact-us', '/faqs', '/how-it-works',
  '/privacy-policy', '/security', '/terms-and-conditions',
  '/signin', '/signup', '/pay', '/invoice', '/auth'
];

const WEBHOOK_PREFIXES = ['/api/webhooks'];

const STATIC_EXTENSIONS = [
  '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.css', '.js', '.map', '.mp4', '.webm', '.mp3', '.wav', '.ogg'
];

function isStaticAsset(pathname: string): boolean {
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}

function isWebhookRoute(pathname: string): boolean {
  return WEBHOOK_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard');
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

// ─── Middleware ───────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Skip _next internal paths
  if (pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Skip webhook routes (they verify their own signatures)
  if (isWebhookRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip the NextAuth API route itself to avoid infinite loops
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Dashboard routes — require authentication
  if (isDashboardRoute(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'thubpay-super-secret-change-me-in-production-2024'
    });

    if (!token) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = '/signin';
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Account routes — require authentication
  if (pathname === '/account') {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'thubpay-super-secret-change-me-in-production-2024'
    });

    if (!token) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = '/signin';
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)'
  ]
};
