import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Curated set of "interesting" audit-log actions worth showing on the
 * dashboard overview. Adapted to what actually lives in the DB today
 * (`invoice.paid`, `webhook.create`, `gateway.create`, `demo.login`,
 * `invoice.mark_paid`, `invoice.void`, `refund.created`, `refund.partial`,
 * `api_key.create`, `api_key.revoke`) plus forward-compatible names from
 * the task spec (`invoice.created`, `payment.received`, `payment.failed`,
 * `refund.issued`, `client.created`, `gateway.connected`,
 * `gateway.disconnected`, `automation.triggered`, `webhook.delivered`,
 * `payment_link.created`, `subscription.activated`,
 * `subscription.cancelled`, `dispute.opened`, `dispute.resolved`).
 *
 * Actions that aren't in the curated set (e.g. `demo.login`) are filtered
 * out server-side so the dashboard never shows a wall of repeated logins.
 */
const INTERESTING_ACTIONS: readonly string[] = [
  // Invoice lifecycle
  'invoice.created',
  'invoice.paid',
  'invoice.mark_paid',
  'invoice.void',
  'invoice.refunded',
  'invoice.sent',
  // Payments
  'payment.received',
  'payment.failed',
  'payment.succeeded',
  // Refunds
  'refund.created',
  'refund.partial',
  'refund.issued',
  // Clients
  'client.created',
  // Gateways
  'gateway.connected',
  'gateway.disconnected',
  'gateway.create',
  'gateway.delete',
  // Automation
  'automation.triggered',
  'automation.fired',
  // Webhooks
  'webhook.delivered',
  'webhook.create',
  'webhook.delete',
  // Payment links
  'payment_link.created',
  // Subscriptions
  'subscription.activated',
  'subscription.cancelled',
  'subscription.created',
  // Disputes
  'dispute.opened',
  'dispute.resolved',
  // API keys (still useful to surface)
  'api_key.create',
  'api_key.revoke',
  // Login (only when explicitly interesting — `demo.login` excluded)
  'login.success',
];

export interface DashboardActivity {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

/**
 * Safely parse the JSON-encoded `metadata` column. Returns null on any
 * failure so the client never receives a malformed payload.
 */
function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Pick a human-readable name + email from the audit log entry. Falls
 * through to metadata (many workspace-wide events like `invoice.paid`
 * are written by the public checkout flow with `userId = null` but the
 * customer name/email in metadata).
 */
function resolveActor(params: {
  user?: { name: string | null; email: string } | null;
  metadata: Record<string, unknown> | null;
}): { userName: string | null; userEmail: string | null } {
  const { user, metadata } = params;
  const metaName =
    metadata && typeof metadata['name'] === 'string'
      ? (metadata['name'] as string)
      : metadata && typeof metadata['customerName'] === 'string'
        ? (metadata['customerName'] as string)
        : null;
  const metaEmail =
    metadata && typeof metadata['email'] === 'string'
      ? (metadata['email'] as string)
      : metadata && typeof metadata['customerEmail'] === 'string'
        ? (metadata['customerEmail'] as string)
        : null;

  return {
    userName: user?.name ?? metaName ?? null,
    userEmail: user?.email ?? metaEmail ?? null,
  };
}

/**
 * GET /api/dashboard/activity
 * Returns the most recent ~20 audit log entries for the caller's
 * workspace, filtered server-side to a curated set of "interesting"
 * actions. Used by the dashboard overview "Recent Activity Timeline".
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { workspaceId } = ctx.context;

  try {
    const rows = await db.auditLog.findMany({
      where: {
        workspaceId,
        action: { in: [...INTERESTING_ACTIONS] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    const activities: DashboardActivity[] = rows.map((row) => {
      const metadata = parseMetadata(row.metadata);
      const { userName, userEmail } = resolveActor({
        user: row.user,
        metadata,
      });
      return {
        id: row.id,
        action: row.action,
        entityType: row.entity,
        entityId: row.entityId,
        metadata,
        createdAt: row.createdAt.toISOString(),
        userName,
        userEmail,
      };
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('[api/dashboard/activity] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
