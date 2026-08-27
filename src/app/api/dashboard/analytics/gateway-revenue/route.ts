import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getGatewayRevenue } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/analytics/gateway-revenue
 *
 * Returns revenue and transaction counts grouped by gateway for the
 * authenticated workspace. The shape maps `revenue` -> `amount` for
 * client compatibility.
 *
 * Response shape: { gateway_revenue: [{ gateway, amount, count }, ...] }
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const gatewayRevenue = await getGatewayRevenue(ctx.context.workspaceId);
    const gateway_revenue = gatewayRevenue.map((g) => ({
      gateway: g.gateway,
      amount: g.revenue,
      count: g.count,
    }));
    return NextResponse.json({ gateway_revenue });
  } catch (error) {
    console.error('[api/analytics/gateway-revenue] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
