import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// ─── Standalone User Registration ─────────────────────────────
// Robust user registration with automatic workspace provisioning
// and graceful error handling.
//
// H14 fix: the user + workspace + onboarding + starter gateway credentials
// are now created inside a single Prisma $transaction, so a partial failure
// rolls back the user row (no orphaned users without a workspace).

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Please enter a valid email address' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  try {
    const existing = await db.appUser.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { success: false, error: 'An account with this email already exists' };
    }

    // M3 fix: bumped bcrypt cost factor from 10 to 12 (≈250ms on modern CPUs).
    const passwordHash = await bcrypt.hash(password, 12);

    // Run the user + workspace + onboarding + starter gateway rows in a single
    // transaction — if any of them fails, nothing is committed and the caller
    // sees a clean error rather than an orphaned user.
    const user = await db.$transaction(async (tx) => {
      const created = await tx.appUser.create({
        data: {
          email: normalizedEmail,
          name: name || normalizedEmail.split('@')[0],
          passwordHash,
          role: 'owner',
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: `${name || 'My'}'s Workspace`,
          slug: `workspace-${created.id.slice(-6)}`,
          ownerUserId: created.id,
          plan: 'free',
          baseCurrency: 'USD',
          monthlyTargetCents: 500000,
          onboardingCompleted: false,
          members: {
            create: { userId: created.id, role: 'owner' },
          },
        },
      });

      await tx.onboardingProgress.create({
        data: { workspaceId: workspace.id },
      });

      await tx.gatewayCredential.createMany({
        data: [
          {
            workspaceId: workspace.id,
            gatewaySlug: 'stripe',
            label: 'Stripe (Test)',
            publishableKey: 'pk_test_demo',
            mode: 'test',
            isActive: false,
            isDefault: false,
          },
          {
            workspaceId: workspace.id,
            gatewaySlug: 'paypal',
            label: 'PayPal (Test)',
            publishableKey: 'paypal_test_client_id',
            mode: 'test',
            isActive: false,
            isDefault: false,
          },
        ],
      });

      return created;
    });

    return { success: true, userId: user.id };
  } catch (err: any) {
    // Prisma's unique-constraint violation code (P2002) on email — race with
    // another concurrent registration.
    if (err?.code === 'P2002') {
      return { success: false, error: 'An account with this email already exists' };
    }
    console.error('[register] Database error during registration:', err?.code || err?.message || err);
    return {
      success: false,
      error:
        'Database is currently initializing or unreachable. Please try using demo account admin@thubpay.com / admin123',
    };
  }
}
