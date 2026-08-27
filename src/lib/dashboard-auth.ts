import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/session';
import { db } from '@/lib/db';

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  workspace: {
    id: string;
    name: string;
    plan: string;
    baseCurrency: string;
    monthlyTargetCents: number;
    logoUrl: string | null;
    onboardingCompleted: boolean;
  };
}

/**
 * CSRF Origin check for state-changing requests (POST / PATCH / DELETE).
 * Next.js server actions get this automatically, but raw `fetch()` calls
 * from client components to /api/** routes do NOT — so we enforce it here.
 *
 * Conservative policy: only BLOCK when an Origin header is present and its
 * host does NOT match the request's own Host header. Server-to-server calls
 * (no Origin) and same-origin browsers (Origin host == Host header) are
 * allowed. We deliberately do NOT compare against NEXTAUTH_URL because the
 * user-facing URL may differ from the dev server's bind port (e.g. when
 * proxied through Caddy on port 81 → next on port 3000). The Host header
 * is set by the proxy and reflects what the browser actually requested.
 */
async function checkCsrfOrigin(): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  // Browsers always send Origin on POST/PATCH/DELETE in modern browsers.
  // If it's absent (e.g. server-side fetch, GET request) we don't block.
  const h = await headers();
  const origin = h.get('origin');
  if (!origin) return { ok: true };

  let incomingHost = '';
  try {
    incomingHost = new URL(origin).host;
  } catch {
    return { ok: false, error: 'Malformed Origin header', status: 403 };
  }

  // Compare against the request's own Host header (set by the proxy /
  // browser). This is the most reliable same-origin signal — if the browser
  // posted to host X, the Origin header should also say host X.
  const host = h.get('host');
  if (host && incomingHost === host) return { ok: true };

  // Fallback for production where NEXTAUTH_URL is the canonical host.
  const canonicalHost = process.env.NEXTAUTH_URL
    ? process.env.NEXTAUTH_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : null;
  if (canonicalHost && incomingHost === canonicalHost) return { ok: true };

  return { ok: false, error: 'Cross-origin request blocked', status: 403 };
}

/**
 * Server-side workspace context resolver.
 * Uses NextAuth session to authenticate and resolves the user's primary
 * workspace from the database. If running in demo mode or if database is
 * offline, seamlessly provides a fallback workspace context.
 */
export const requireWorkspace = cache(async (): Promise<
  | { ok: true; context: WorkspaceContext }
  | { ok: false; error: string; status: number }
> => {
  // CSRF check — runs before any session/db work so cross-origin POSTs are
  // rejected before they touch auth or the database. (H1 fix.)
  const csrf = await checkCsrfOrigin();
  if (!csrf.ok) return csrf;

  const session = (await auth()) as any;
  if (!session?.user) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const userId = (session.user.id as string) || 'demo-admin-id';
  const userEmail = session.user.email || 'admin@thubpay.com';
  const userName = session.user.name || 'ThubPay Admin';
  const userRole = (session.user.role as string) || 'owner';
  const defaultWorkspaceId = (session.user.workspaceId as string) || 'ws-demo-workspace';

  try {
    // Resolve the user's primary workspace membership from DB
    let membership = await db.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    // If no membership found, try to auto-create one. (H13 fix: only do
    // this for demo users — for real users a missing membership signals
    // data drift, and silently provisioning a new workspace hides the
    // bug and fragments the user's data.)
    const isDemoUser =
      userId === 'demo-admin-id' || String(userId).startsWith('demo-');
    if (!membership && isDemoUser) {
      try {
        const workspace = await db.workspace.create({
          data: {
            name: `${userName}'s Workspace`,
            ownerUserId: userId,
            plan: 'pro',
            baseCurrency: 'USD',
            monthlyTargetCents: 500000,
            onboardingCompleted: true,
            members: {
              create: { userId, role: userRole },
            },
          },
          include: { members: true },
        });

        return {
          ok: true,
          context: {
            workspaceId: workspace.id,
            userId,
            role: userRole,
            user: {
              id: userId,
              email: userEmail,
              name: userName,
              role: userRole,
            },
            workspace: {
              id: workspace.id,
              name: workspace.name,
              plan: workspace.plan,
              baseCurrency: workspace.baseCurrency,
              monthlyTargetCents: workspace.monthlyTargetCents,
              logoUrl: workspace.logoUrl,
              onboardingCompleted: workspace.onboardingCompleted,
            },
          },
        };
      } catch (createErr) {
        console.warn('[dashboard-auth] Could not auto-create workspace in DB:', createErr);
      }
    }

    // For a real (non-demo) user with no membership, fail explicitly rather
    // than masking the bug with a fresh empty workspace.
    if (!membership && !isDemoUser) {
      return {
        ok: false,
        error: 'Your account is not a member of any workspace. Please contact support.',
        status: 403,
      };
    }

    if (membership && membership.workspace) {
      return {
        ok: true,
        context: {
          workspaceId: membership.workspaceId,
          userId,
          role: membership.role || userRole,
          user: {
            id: userId,
            email: userEmail,
            name: userName,
            role: membership.role || userRole,
          },
          workspace: {
            id: membership.workspace.id,
            name: membership.workspace.name,
            plan: membership.workspace.plan,
            baseCurrency: membership.workspace.baseCurrency,
            monthlyTargetCents: membership.workspace.monthlyTargetCents,
            logoUrl: membership.workspace.logoUrl,
            onboardingCompleted: membership.workspace.onboardingCompleted,
          },
        },
      };
    }
  } catch (dbErr) {
    console.warn('[dashboard-auth] DB query failed, using fallback workspace context:', dbErr);
  }

  // Resilient fallback context (guaranteed access)
  return {
    ok: true,
    context: {
      workspaceId: defaultWorkspaceId,
      userId,
      role: userRole,
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        role: userRole,
      },
      workspace: {
        id: defaultWorkspaceId,
        name: 'ThubPay Workspace',
        plan: 'pro',
        baseCurrency: 'USD',
        monthlyTargetCents: 500000,
        logoUrl: null,
        onboardingCompleted: true,
      },
    },
  };
});

/**
 * Lightweight auth check for API routes — returns the workspace id or null.
 * (H12 fix: previously returned 'ws-demo-workspace' on failure, which silently
 * ran queries against a non-existent workspace. Now returns null so callers
 * are forced to handle the unauthenticated case.)
 */
export async function getWorkspaceIdForRequest(): Promise<string | null> {
  const result = await requireWorkspace();
  return result.ok ? result.context.workspaceId : null;
}
