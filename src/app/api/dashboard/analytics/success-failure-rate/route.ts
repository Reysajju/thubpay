import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import { getSuccessFailureRates } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/analytics/success-failure-rate
 *
 * Returns aggregate success/failure counts plus a 6-month trend.
 * Aggregate numbers are derived from Transactions; the trend comes
 * from `getSuccessFailureRates` (which buckets by month).
 *
 * Response shape:
 *   {
 *     total: number,
 *     succeeded: number,
 *     failed: number,
 *     success_rate: string,    // e.g. "92.3"
 *     failure_rate: string,    // e.g. "7.7"
 *     trend: [{ date, success, failed }, ...]
 *   }
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const [succeeded, failed, pending, trend] = await Promise.all([
      db.transaction.count({
        where: { workspaceId: ctx.context.workspaceId, status: 'succeeded' },
      }),
      db.transaction.count({
        where: { workspaceId: ctx.context.workspaceId, status: 'failed' },
      }),
      db.transaction.count({
        where: {
          workspaceId: ctx.context.workspaceId,
          status: { in: ['pending', 'refunded', 'disputed'] },
        },
      }),
      getSuccessFailureRates(ctx.context.workspaceId),
    ]);

    const total = succeeded + failed + pending;
    const successRate = total > 0 ? ((succeeded / total) * 100).toFixed(1) : '0';
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0';

    return NextResponse.json({
      total,
      succeeded,
      failed,
      success_rate: successRate,
      failure_rate: failureRate,
      trend,
    });
  } catch (error) {
    console.error('[api/analytics/success-failure-rate] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
