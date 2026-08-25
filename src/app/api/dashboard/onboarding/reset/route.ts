import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/onboarding/reset
 * Resets the onboarding progress for the current workspace so the
 * walkthrough modal + checklist card re-appear. Useful for testing,
 * demos, and onboarding new team members to existing workspaces.
 */
export async function POST(_req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { workspaceId } = ctx.context;

    // Reset every onboarding flag back to false.
    await db.onboardingProgress.upsert({
      where: { workspaceId },
      update: {
        stepGateway: false,
        stepBrand: false,
        stepClient: false,
        stepInvoice: false,
        walkthroughSkipped: false,
      },
      create: {
        workspaceId,
        stepGateway: false,
        stepBrand: false,
        stepClient: false,
        stepInvoice: false,
        walkthroughSkipped: false,
      },
    });

    // Also flip the workspace-level completion flag back off so the
    // dashboard's OnboardingChecklistCard becomes visible again.
    await db.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompleted: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Onboarding progress reset. The walkthrough will reappear on the next dashboard load.',
    });
  } catch (error) {
    console.error('[api/onboarding/reset] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
