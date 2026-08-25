import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getSubscriptions } from '@/lib/demo-data';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/subscriptions
 * Returns the list of recurring subscriptions for the authenticated workspace.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const subscriptions = await getSubscriptions(ctx.context.workspaceId);
    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('[api/subscriptions] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/subscriptions
 * Create a new subscription plan / recurring subscription.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      plan_name,
      amount_usd,
      cycle = 'monthly',
      client_id,
      gateway_slug = 'stripe',
    } = body;

    if (!plan_name || !amount_usd || Number(amount_usd) <= 0) {
      return NextResponse.json({ error: 'Plan name and positive amount are required' }, { status: 400 });
    }

    const amountCents = Math.round(Number(amount_usd) * 100);
    const nextBillingDate = new Date();

    // Calculate next billing timestamp based on cycle
    const cycleStr = String(cycle).toLowerCase();
    if (cycleStr.includes('week') || cycleStr.includes('7d')) {
      nextBillingDate.setDate(nextBillingDate.getDate() + 7);
    } else if (cycleStr.includes('quarter') || cycleStr.includes('3m')) {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
    } else if (cycleStr.includes('year') || cycleStr.includes('12m')) {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else if (cycleStr.includes('day')) {
      const days = parseInt(cycleStr.replace(/[^0-9]/g, ''), 10) || 14;
      nextBillingDate.setDate(nextBillingDate.getDate() + days);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    const subscription = await db.subscription.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        planName: plan_name.trim(),
        amountCents,
        currency: 'USD',
        cycle: cycle || 'monthly',
        clientId: client_id || null,
        gatewaySlug: gateway_slug || null,
        status: 'active',
        nextBillingAt: nextBillingDate,
      },
      include: { client: true },
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        client_id: subscription.clientId,
        client_name: subscription.client?.name ?? null,
        client_email: subscription.client?.email ?? null,
        plan_name: subscription.planName,
        amount_cents: subscription.amountCents,
        currency: subscription.currency,
        status: subscription.status,
        cycle: subscription.cycle,
        gateway_slug: subscription.gatewaySlug,
        next_billing_at: subscription.nextBillingAt ? subscription.nextBillingAt.toISOString() : null,
        started_at: subscription.startedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[api/subscriptions] POST error:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

/**
 * PATCH /api/dashboard/subscriptions
 * Update subscription status (active, paused, canceled).
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 });
    }

    const updated = await db.subscription.update({
      where: { id },
      data: {
        status,
        canceledAt: status === 'canceled' ? new Date() : null,
      },
    });

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    console.error('[api/subscriptions] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

