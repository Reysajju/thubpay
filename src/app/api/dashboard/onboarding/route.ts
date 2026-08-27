import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getOnboardingState, updateOnboardingStep } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/onboarding
 * Returns the onboarding state + completion percentage.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const state = await getOnboardingState(ctx.context.workspaceId);
    return NextResponse.json(state);
  } catch (error) {
    console.error('[api/onboarding] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/dashboard/onboarding
 * Update an onboarding step or skip the walkthrough.
 * Body: { step?: 'stepGateway'|'stepBrand'|'stepClient'|'stepInvoice', value?: boolean, skipWalkthrough?: boolean }
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = await req.json();
    const { step, value, skipWalkthrough } = body as {
      step?: string;
      value?: boolean;
      skipWalkthrough?: boolean;
    };

    if (skipWalkthrough) {
      const result = await updateOnboardingStep(ctx.context.workspaceId, 'walkthroughSkipped', true);
      return NextResponse.json(result);
    }

    if (!step || typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'step and value are required' },
        { status: 400 }
      );
    }

    const result = await updateOnboardingStep(ctx.context.workspaceId, step, value);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/onboarding] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
