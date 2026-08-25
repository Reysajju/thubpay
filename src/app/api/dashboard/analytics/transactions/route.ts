import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/analytics/transactions
 *
 * Returns the 100 most recent transactions for the authenticated
 * workspace, including the linked gateway and invoice for context.
 *
 * Response shape: { transactions: [...] }
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const transactions = await db.transaction.findMany({
      where: { workspaceId: ctx.context.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { gateway: true, invoice: true },
    });

    // Map to a client-friendly shape
    const mapped = transactions.map((t) => ({
      id: t.id,
      workspace_id: t.workspaceId,
      invoice_id: t.invoiceId,
      gateway_id: t.gatewayId,
      gateway_slug: t.gatewaySlug,
      gateway_label: t.gateway?.label || null,
      external_id: t.externalId,
      amount_cents: t.amountCents,
      currency: t.currency,
      status: t.status,
      failure_reason: t.failureReason,
      customer_email: t.customerEmail,
      customer_name: t.customerName,
      invoice_number: t.invoice?.invoiceNumber || null,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    }));

    return NextResponse.json({ transactions: mapped });
  } catch (error) {
    console.error('[api/analytics/transactions] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
