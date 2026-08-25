import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/clients/[id]
 *
 * Returns a single client with their invoice history.
 * Scoped to the authenticated workspace.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id } = await params;

  try {
    const client = await db.client.findFirst({
      where: { id, workspaceId: ctx.context.workspaceId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company,
        total_spend_cents: client.totalSpendCents,
        transaction_count: client.transactionCount,
        created_at: client.createdAt.toISOString(),
      },
      invoices: client.invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        status: inv.status,
        total_cents: inv.totalCents,
        currency: inv.currency,
        due_date: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
        paid_via_gateway: inv.paidViaGateway,
        custom_payment_gateway: inv.customPaymentGateway,
        created_at: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[api/clients/[id]] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
