import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getTopCustomers } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/analytics/top-customers
 *
 * Returns the top 5 customers by total spend for the authenticated
 * workspace.
 *
 * Response shape:
 *   { top_customers: [{ name, email, total_spend_cents, transaction_count }, ...] }
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const topCustomers = await getTopCustomers(ctx.context.workspaceId);
    const mapped = topCustomers.map((c) => ({
      name: c.name,
      email: c.email,
      total_spend_cents: c.totalSpend,
      transaction_count: c.transactionCount,
    }));
    return NextResponse.json({ top_customers: mapped });
  } catch (error) {
    console.error('[api/analytics/top-customers] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
