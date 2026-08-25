import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getAutomationRules } from '@/lib/demo-data';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/automation/rules
 * Returns the list of automation rules for the authenticated workspace.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const rules = await getAutomationRules(ctx.context.workspaceId);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error('[api/automation/rules] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/automation/rules
 * Create a new automation rule in the database.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, trigger, action, gateway_slug } = body;
    if (!name || !trigger || !action) {
      return NextResponse.json({ error: 'Name, trigger, and action are required' }, { status: 400 });
    }

    const rule = await db.automationRule.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        name: name.trim(),
        trigger,
        action,
        gatewaySlug: gateway_slug || null,
        status: 'active',
        executions: 0,
      },
    });

    return NextResponse.json({
      rule: {
        id: rule.id,
        name: rule.name,
        trigger: rule.trigger,
        action: rule.action,
        gateway_slug: rule.gatewaySlug,
        status: rule.status,
        executions: rule.executions,
        last_run_at: null,
        created_at: rule.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[api/automation/rules] POST error:', error);
    return NextResponse.json({ error: 'Failed to create automation rule' }, { status: 500 });
  }
}

/**
 * PATCH /api/dashboard/automation/rules
 * Update status (active / paused) of a rule.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 });
    }

    const updated = await db.automationRule.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ rule: updated });
  } catch (error) {
    console.error('[api/automation/rules] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

/**
 * DELETE /api/dashboard/automation/rules
 * Delete an automation rule.
 */
export async function DELETE(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await db.automationRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/automation/rules] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}

