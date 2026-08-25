import { NextRequest, NextResponse } from 'next/server';

// ─── In-Memory Rate Limiter ──────────────────────────────────
// Simple sliding-window rate limiter for protecting auth endpoints.
// In production with multiple instances, replace with Redis-backed limiter.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_STORE = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// Pre-configured limits for different endpoint types
export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 attempts per 15 min
  register: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 signups per hour
  api: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per min
  public: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per min
} as const;

/**
 * Get client IP from request, accounting for proxies.
 */
function getClientIP(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri;
  return 'unknown';
}

/**
 * Check rate limit for a given key.
 * Returns { allowed: boolean, remaining: number, resetAt: number }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = RATE_LIMIT_STORE.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit a request. If the limit is exceeded, returns a 429 NextResponse.
 * Otherwise returns null (allow the request to proceed).
 *
 * @example
 * const limited = rateLimit(req, 'auth', RATE_LIMITS.auth);
 * if (limited) return limited;
 */
export function rateLimit(
  req: NextRequest,
  namespace: string,
  config: RateLimitConfig
): NextResponse | null {
  const ip = getClientIP(req);
  const key = `${namespace}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Periodically clean up expired entries to prevent memory leaks.
 * Called on every rate limit check.
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of RATE_LIMIT_STORE.entries()) {
    if (now > entry.resetAt) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
  // Prevent the store from growing unbounded
  if (RATE_LIMIT_STORE.size > 10000) {
    // Drop oldest 20% of entries
    const entries = Array.from(RATE_LIMIT_STORE.entries()).sort(
      (a, b) => a[1].resetAt - b[1].resetAt
    );
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      RATE_LIMIT_STORE.delete(entries[i][0]);
    }
  }
}
