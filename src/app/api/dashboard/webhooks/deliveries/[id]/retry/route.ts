// ─────────────────────────────────────────────────────────────
// Manual Webhook Delivery Retry
// POST /api/dashboard/webhooks/deliveries/[id]/retry
//
// Re-attempts a single failed WebhookDelivery immediately, bypassing
// the nextRetryAt schedule. Useful for "Retry now" buttons in the
// admin UI. Auth required (workspace-scoped).
//
// Returns: { ok, status, attempts, error? }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { retryDeliveryById, MAX_WEBHOOK_ATTEMPTS } from '@/lib/webhook-dispatch';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: deliveryId } = await params;

  // Verify the delivery belongs to this workspace (authz).
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { workspaceId: true, attempts: true, status: true },
  });
  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }
  if (delivery.workspaceId !== ctx.context.workspaceId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (delivery.attempts >= MAX_WEBHOOK_ATTEMPTS) {
    return NextResponse.json({
      ok: false,
      status: 'exhausted',
      error: `Already at max attempts (${MAX_WEBHOOK_ATTEMPTS}).`,
    }, { status: 409 });
  }
  if (delivery.status === 'ok') {
    return NextResponse.json({
      ok: true,
      status: 'already_ok',
      attempts: delivery.attempts,
    });
  }

  const result = await retryDeliveryById(deliveryId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
