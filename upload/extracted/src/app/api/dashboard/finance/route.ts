import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getFinanceData } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/finance
 * Returns finance data: ledger, metrics, monthly trends, fee breakdown.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const finance = await getFinanceData(ctx.context.workspaceId);
    return NextResponse.json({ finance });
  } catch (error) {
    console.error('[api/finance] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
