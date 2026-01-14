import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getCookieNames } from '@/lib/cookie-config';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth'];

// Routes that require admin or rootAdmin role
const adminRoutes = ['/users', '/api/users'];

// Routes that require rootAdmin role only
const rootAdminRoutes = ['/audit-logs', '/api/audit-logs'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const cookieNames = getCookieNames();
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: cookieNames.sessionToken,
  });

  if (!token) {
    // Redirect to login for page routes
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Return 401 for API routes
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin routes
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (token.role !== 'admin' && token.role !== 'rootAdmin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Check rootAdmin routes (audit logs)
  if (rootAdminRoutes.some((route) => pathname.startsWith(route))) {
    if (token.role !== 'rootAdmin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden - Root Admin only' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Check DELETE operations for users - only rootAdmin
  if (pathname.match(/^\/api\/users\/[^/]+$/) && request.method === 'DELETE') {
    if (token.role !== 'rootAdmin') {
      return NextResponse.json({ error: 'Forbidden - Root Admin only' }, { status: 403 });
    }
  }

  // Check DELETE operations for tasks, clients, categories
  // RootAdmin can delete any record
  // Admin can delete only their own records (checked in route handler)
  // User cannot delete any records
  if (
    (pathname.match(/^\/api\/tasks\/[^/]+$/) ||
      pathname.match(/^\/api\/clients\/[^/]+$/) ||
      pathname.match(/^\/api\/categories\/[^/]+$/)) &&
    request.method === 'DELETE'
  ) {
    if (token.role === 'user') {
      return NextResponse.json(
        { error: 'Forbidden - Users cannot delete records' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
