import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to add security headers and set session cookie
 * Runs on Edge runtime for all API routes
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Set a session cookie for tracking (anonymous, for rate limiting)
  // This helps identify users even if they're behind a shared IP (like corporate networks)
  const sessionCookie = request.cookies.get('ocr-session');
  
  if (!sessionCookie && request.nextUrl.pathname.startsWith('/api/ocr')) {
    // Generate a random session ID
    const sessionId = crypto.randomUUID();
    response.cookies.set('ocr-session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
  }

  return response;
}

// Only run middleware on API routes
export const config = {
  matcher: ['/api/:path*'],
};
