import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getDisputeStats } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/disputes
 * Returns dispute stats and list for the authenticated workspace.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const stats = await getDisputeStats(ctx.context.workspaceId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[api/disputes] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
