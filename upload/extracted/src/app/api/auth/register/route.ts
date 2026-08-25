import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/register';
import { rateLimit, RATE_LIMITS, cleanupRateLimitStore } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register
 * Register a new user account. Provisions a default workspace + starter
 * gateway credentials. Passwords are hashed with bcrypt before storage.
 * Rate-limited to 5 signups per hour per IP.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  cleanupRateLimitStore();
  const limited = rateLimit(request, 'register', RATE_LIMITS.register);
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { email, password, name } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // registerUser is async — it provisions the user + workspace + gateways
    const result = await registerUser(
      String(email),
      String(password),
      name ? String(name) : ''
    );

    if (!result.success) {
      // Validation errors (invalid email / short password / duplicate) → 409
      return NextResponse.json(
        { error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      email: String(email).trim().toLowerCase(),
      userId: result.userId,
    });
  } catch (error) {
    console.error('[api/auth/register] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
