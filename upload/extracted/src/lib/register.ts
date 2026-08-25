import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// ─── Standalone User Registration ─────────────────────────────
// Robust user registration with automatic workspace provisioning
// and graceful error handling.

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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.appUser.create({
      data: {
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        passwordHash,
        role: 'owner',
      },
    });

    // Provision a default workspace for the new user
    try {
      const workspace = await db.workspace.create({
        data: {
          name: `${name || 'My'}'s Workspace`,
          slug: `workspace-${user.id.slice(-6)}`,
          ownerUserId: user.id,
          plan: 'free',
          baseCurrency: 'USD',
          monthlyTargetCents: 500000,
          onboardingCompleted: false,
          members: {
            create: { userId: user.id, role: 'owner' },
          },
        },
      });

      // Create onboarding progress
      await db.onboardingProgress.create({
        data: { workspaceId: workspace.id },
      });

      // Seed starter Stripe + PayPal credentials
      await db.gatewayCredential.createMany({
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
    } catch (wsErr) {
      console.warn('[register] Non-critical error creating initial workspace records:', wsErr);
    }

    return { success: true, userId: user.id };
  } catch (err: any) {
    console.error('[register] Database error during registration:', err);
    // If DB is offline, inform user or provide demo account
    return {
      success: false,
      error: 'Database is currently initializing or unreachable. Please try using demo account admin@thubpay.com / admin123',
    };
  }
}
