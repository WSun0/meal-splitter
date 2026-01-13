/**
 * Server-side rate limiter using Upstash Redis
 * This provides REAL protection against abuse, unlike the client-side localStorage tracker
 * 
 * Rate limits:
 * - Per IP: 50 requests per month (prevents single user from hogging quota)
 * - Global: 900 requests per month (free tier protection with 100 buffer)
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

// Initialize Redis client - will be undefined if env vars not set
let redis: Redis | null = null;
let rateLimitPerIP: Ratelimit | null = null;
let rateLimitGlobal: Ratelimit | null = null;

function initializeRateLimiters() {
  if (redis) return; // Already initialized

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    console.warn(
      'Upstash Redis not configured. Rate limiting disabled. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.'
    );
    return;
  }

  redis = new Redis({
    url: upstashUrl,
    token: upstashToken,
  });

  // Per-IP monthly limit: 50 requests per month
  rateLimitPerIP = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '30 d'),
    prefix: 'ocr:ip',
    analytics: true,
  });

  // Global monthly limit: 900 requests per month (protects your free tier)
  rateLimitGlobal = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(900, '30 d'),
    prefix: 'ocr:global',
    analytics: true,
  });
}

/**
 * Get client IP address from request headers
 * Works on Vercel with x-forwarded-for and x-real-ip headers
 */
export async function getClientIP(): Promise<string> {
  const headersList = await headers();
  
  // Vercel provides these headers
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIP = headersList.get('x-real-ip');
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (client)
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback for local development
  return '127.0.0.1';
}

/**
 * Generate a session identifier from cookies or create one
 * This provides an additional layer of identification beyond IP
 */
export async function getSessionId(): Promise<string | null> {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');
  
  if (!cookieHeader) return null;
  
  // Look for our session cookie
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('ocr-session='));
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1];
  }
  
  return null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter: number; // seconds
  limitType: 'ip' | 'global' | null;
}

/**
 * Check all rate limits for a request
 * Returns combined result with the most restrictive limit
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  initializeRateLimiters();

  // If rate limiting is not configured, allow request (development mode)
  if (!rateLimitPerIP || !rateLimitGlobal) {
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 60000),
      retryAfter: 0,
      limitType: null,
    };
  }

  // Check both limits in parallel
  const [ipResult, globalResult] = await Promise.all([
    rateLimitPerIP.limit(identifier),
    rateLimitGlobal.limit('global'), // Same key for all users
  ]);

  // Check per-IP limit first
  if (!ipResult.success) {
    return {
      allowed: false,
      remaining: ipResult.remaining,
      resetAt: new Date(ipResult.reset),
      retryAfter: Math.ceil((ipResult.reset - Date.now()) / 1000),
      limitType: 'ip',
    };
  }

  // Check global limit
  if (!globalResult.success) {
    return {
      allowed: false,
      remaining: globalResult.remaining,
      resetAt: new Date(globalResult.reset),
      retryAfter: Math.ceil((globalResult.reset - Date.now()) / 1000),
      limitType: 'global',
    };
  }

  // Both limits passed - return the most restrictive remaining count
  const minRemaining = Math.min(ipResult.remaining, globalResult.remaining);

  return {
    allowed: true,
    remaining: minRemaining,
    resetAt: new Date(Math.min(ipResult.reset, globalResult.reset)),
    retryAfter: 0,
    limitType: null,
  };
}

/**
 * Get rate limit headers to include in response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfter > 0 && { 'Retry-After': result.retryAfter.toString() }),
  };
}
