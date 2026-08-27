import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getMonthlyRevenue } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/analytics/revenue
 *
 * Returns the last 12 months of revenue (in cents) for the
 * authenticated workspace, grouped by month.
 *
 * Response shape: { revenue: [{ date, amount }, ...] }
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const revenue = await getMonthlyRevenue(ctx.context.workspaceId);
    return NextResponse.json({ revenue });
  } catch (error) {
    console.error('[api/analytics/revenue] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
