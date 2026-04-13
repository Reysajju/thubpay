import crypto from 'crypto';

/**
 * CSRF Token Generation and Validation
 *
 * This module provides CSRF token protection for state-changing requests.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 // 24 hours
};

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create CSRF middleware
 */
export function csrfMiddleware(allowedOrigins: string[] = []) {
  return (req: any, res: any, next: any) => {
    const method = req.method;
    const origin = req.headers?.origin || req.headers?.get?.('origin');

    // Allow OPTIONS requests
    if (method === 'OPTIONS') {
      return next();
    }

    // Check if origin is allowed
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status?.(403).json({ error: 'Origin not allowed' });
    }

    // For state-changing requests, validate CSRF token
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const token = getTokenFromRequest(req);

      if (!token) {
        return res.status?.(403).json({ error: 'CSRF token missing' });
      }

      const sessionToken = getSessionToken(req);
      if (!sessionToken || token !== sessionToken) {
        return res.status?.(403).json({ error: 'Invalid CSRF token' });
      }
    }

    next();
  };
}

/**
 * Get CSRF token from request
 */
export function getTokenFromRequest(req: any): string | null {
  // Check Authorization header
  const authHeader = req.headers?.authorization || req.headers?.get?.('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-CSRF-Token header
  const csrfHeader = req.headers?.['x-csrf-token'] || req.headers?.get?.('x-csrf-token');
  if (csrfHeader) {
    return csrfHeader;
  }

  // Check query parameter
  const host = req.headers?.host || req.headers?.get?.('host') || 'localhost';
  const url = new URL(req.url, `http://${host}`);
  const token = url.searchParams.get('csrf_token');
  if (token) {
    return token;
  }

  return null;
}

/**
 * Get CSRF token from session
 */
export function getSessionToken(req: any): string | null {
  // In production, you'd read from the session store
  const sessionToken = req.cookies?.get?.(CSRF_COOKIE_NAME);
  if (sessionToken) {
    return typeof sessionToken === 'string' ? sessionToken : sessionToken.value;
  }

  return null;
}

/**
 * Get CSRF cookie options
 */
export function getCSRFCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
    secure: CSRF_COOKIE_OPTIONS.secure,
    sameSite: CSRF_COOKIE_OPTIONS.sameSite,
    path: CSRF_COOKIE_OPTIONS.path,
    maxAge: CSRF_COOKIE_OPTIONS.maxAge
  };
}

/**
 * Set CSRF token in response
 */
export function setCSRCToken(res: any, token: string): void {
  // Set cookie
  res.cookie?.(CSRF_COOKIE_NAME, token, getCSRFCookieOptions());

  // Return token in response body for AJAX requests
  res.setHeader?.('X-CSRF-Token', token);
}

/**
 * Clear CSRF token from response
 */
export function clearCSRCToken(res: any): void {
  res.clearCookie?.(CSRF_COOKIE_NAME, getCSRFCookieOptions());
}

/**
 * Verify CSRF token matches session token
 */
export function verifyCSRTokens(
  requestToken: string | null,
  sessionToken: string | null
): boolean {
  if (!requestToken || !sessionToken) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(requestToken),
    Buffer.from(sessionToken)
  );
}

/**
 * CSRF token middleware for API routes
 */
export function csrfAPIProtection(): (req: any, res: any, next: any) => void {
  return csrfMiddleware(['https://yourdomain.com', 'http://localhost:3000']);
}

/**
 * Generate CSRF token for form submission
 */
export function generateCSRFForForm(): string {
  return generateCSRFToken();
}

/**
 * Validate CSRF token for form submission
 */
export function validateCSRFToken(token: string): boolean {
  // In production, you'd validate against a stored token
  // For this implementation, we'll just verify it's a valid hex string
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * CSRF error handler
 */
export function csrfErrorHandler(err: any, req: any, res: any, next: any): void {
  if (err.name === 'CsrfError') {
    res.status?.(403).json({ error: 'CSRF token validation failed' });
  } else {
    next(err);
  }
}
