import { createClient as createAdminClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitRule {
  identifier: string;
  endpointType: string;
  requestsPerWindow: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Default rate limit rules
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitRule> = {
  auth: {
    identifier: 'ip',
    endpointType: 'auth',
    requestsPerWindow: 5,
    windowSeconds: 60 // 5 requests per minute
  },
  api: {
    identifier: 'ip',
    endpointType: 'api',
    requestsPerWindow: 100,
    windowSeconds: 60 // 100 requests per minute
  },
  checkout: {
    identifier: 'ip',
    endpointType: 'checkout',
    requestsPerWindow: 10,
    windowSeconds: 60 // 10 requests per minute
  },
  payout: {
    identifier: 'workspace',
    endpointType: 'payout',
    requestsPerWindow: 5,
    windowSeconds: 3600 // 5 requests per hour
  },
  webhook: {
    identifier: 'ip',
    endpointType: 'webhook',
    requestsPerWindow: 100,
    windowSeconds: 60
  }
};

/**
 * Check rate limit using sliding window algorithm with Redis
 */
export async function checkRateLimit(
  identifier: string,
  endpointType: string,
  windowSeconds: number = 60,
  requestsPerWindow: number = 100
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  try {
    // Using Redis for distributed rate limiting
    const key = `rate_limit:${identifier}:${endpointType}`;

    // Get current count
    const current = await redis.incr(key);

    // If this is the first request in the window, set expiration
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, requestsPerWindow - current);
    const resetAt = new Date(now + (windowSeconds * 1000) - ((current - 1) * 1000) - 1000);

    return {
      allowed: current <= requestsPerWindow,
      remaining,
      resetAt
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fall through and allow request
    return {
      allowed: true,
      remaining: requestsPerWindow - 1,
      resetAt: new Date(now + windowSeconds * 1000)
    };
  }
}

/**
 * Check rate limit with identifier
 */
export async function checkRateLimitWithIdentifier(
  identifier: string,
  endpointType: string
): Promise<RateLimitResult> {
  const rule = DEFAULT_RATE_LIMITS[endpointType];
  if (!rule) {
    return {
      allowed: true,
      remaining: 99,
      resetAt: new Date(Date.now() + 60 * 1000)
    };
  }

  return checkRateLimit(
    rule.identifier === 'ip' ? identifier : `${rule.identifier}:${identifier}`,
    endpointType,
    rule.windowSeconds,
    rule.requestsPerWindow
  );
}

/**
 * Increment rate limit counter for storage
 */
export async function incrementRateLimitCounter(
  identifier: string,
  endpointType: string,
  count: number = 1
): Promise<void> {
  const key = `rate_limit_db:${identifier}:${endpointType}`;

  await admin.from('rate_limits').insert({
    identifier,
    endpoint_type: endpointType,
    request_count: count,
    window_start: new Date().toISOString()
  });
}

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(
  identifier: string,
  endpointType: string,
  hours: number = 24
): Promise<Array<{
  timestamp: string;
  count: number;
}>> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const { data } = await admin
    .from('rate_limits')
    .select('*')
    .eq('identifier', identifier)
    .eq('endpoint_type', endpointType)
    .gte('window_start', cutoff.toISOString())
    .order('window_start', { ascending: true });

  // Aggregate by hour
  const stats: Record<string, number> = {};

  (data || []).forEach((row) => {
    const hour = new Date(row.window_start).toISOString().slice(0, 13); // YYYY-MM-DDTHH
    stats[hour] = (stats[hour] || 0) + row.request_count;
  });

  return Object.keys(stats).sort().map((hour) => ({
    timestamp: `${hour}:00`,
    count: stats[hour]
  }));
}

/**
 * Enforce rate limit
 */
export async function enforceRateLimit(
  identifier: string,
  endpointType: string
): Promise<RateLimitResult | null> {
  const result = await checkRateLimitWithIdentifier(identifier, endpointType);

  if (!result.allowed) {
    // Log the exceeded limit
    await incrementRateLimitCounter(identifier, endpointType, 1);

    // Store in database for tracking
    await admin
      .from('rate_limits')
      .insert({
        identifier,
        endpoint_type: endpointType,
        request_count: 1,
        window_start: new Date().toISOString()
      });

    return result;
  }

  return null;
}

/**
 * Get remaining requests for an identifier
 */
export async function getRemainingRequests(
  identifier: string,
  endpointType: string
): Promise<number> {
  const rule = DEFAULT_RATE_LIMITS[endpointType];
  if (!rule) return 99;

  const key = `rate_limit:${rule.identifier === 'ip' ? identifier : `${rule.identifier}:${identifier}`}:${endpointType}`;

  try {
    const current = await redis.get(key);
    return current ? Math.max(0, rule.requestsPerWindow - parseInt(current, 10)) : rule.requestsPerWindow;
  } catch {
    return rule.requestsPerWindow;
  }
}

/**
 * Get rate limit reset time
 */
export async function getRateLimitResetTime(
  identifier: string,
  endpointType: string
): Promise<Date> {
  const rule = DEFAULT_RATE_LIMITS[endpointType];
  if (!rule) return new Date(Date.now() + 60 * 1000);

  const key = `rate_limit:${rule.identifier === 'ip' ? identifier : `${rule.identifier}:${identifier}`}:${endpointType}`;

  try {
    const ttl = await redis.ttl(key);
    return new Date(Date.now() + ttl * 1000);
  } catch {
    return new Date(Date.now() + rule.windowSeconds * 1000);
  }
}

/**
 * Custom rate limit rule
 */
export async function setCustomRateLimit(
  endpointType: string,
  identifier: string,
  requestsPerWindow: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, endpointType, windowSeconds, requestsPerWindow);
}

/**
 * Reset rate limit (for testing or manual reset)
 */
export async function resetRateLimit(identifier: string, endpointType: string): Promise<void> {
  const key = `rate_limit:${identifier}:${endpointType}`;
  await redis.del(key);

  // Also delete from database
  await admin
    .from('rate_limits')
    .delete()
    .eq('identifier', identifier)
    .eq('endpoint_type', endpointType);
}

/**
 * Get rate limit performance metrics
 */
export async function getRateLimitMetrics(hours: number = 24): Promise<{
  total_requests: number;
  exceeded_requests: number;
  unique_ips: number;
  average_requests_per_minute: number;
}> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const { data } = await admin
    .from('rate_limits')
    .select('*')
    .gte('window_start', cutoff.toISOString());

  const uniqueIPs = new Set<string>();
  let exceeded = 0;

  (data || []).forEach((row) => {
    uniqueIPs.add(row.identifier);
    if (row.request_count > DEFAULT_RATE_LIMITS[row.endpoint_type]?.requestsPerWindow) {
      exceeded++;
    }
  });

  // Calculate average requests per minute (last hour)
  const lastHourData = await getRateLimitStats('all', 'api', 1);
  const totalRequestsLastHour = lastHourData.reduce((sum, row) => sum + row.count, 0);
  const averagePerMinute = totalRequestsLastHour / 60;

  return {
    total_requests: data?.length || 0,
    exceeded_requests: exceeded,
    unique_ips: uniqueIPs.size,
    average_requests_per_minute: averagePerMinute
  };
}

/**
 * Prepare rate limit response headers
 */
export function getRateLimitHeaders(result: RateLimitResult): {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
} {
  return {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() })
  };
}

/**
 * Middleware for rate limiting
 */
export function rateLimitMiddleware(identifier: string, endpointType: string) {
  return async (req: Request, res: Response, next: any) => {
    // Get IP address or identifier
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress;
    const limitResult = await enforceRateLimit(ip, endpointType);

    if (limitResult) {
      return res.status(429).json({
        error: 'Too many requests',
        retry_after: Math.ceil((limitResult.resetAt.getTime() - Date.now()) / 1000)
      });
    }

    next();
  };
}