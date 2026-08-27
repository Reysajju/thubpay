import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function sanitizeNotification(row: {
  id: string;
  workspaceId: string;
  title: string;
  body: string | null;
  type: string;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    title: row.title,
    body: row.body,
    type: row.type,
    is_read: row.isRead,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * PATCH /api/dashboard/settings/notifications/[id]
 *
 * Toggle (or explicitly set) the `isRead` flag on a notification.
 * Body (optional): `{ is_read: boolean }`. Omit to toggle.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing notification ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { is_read } = (body || {}) as { is_read?: unknown };

    const existing = await db.notification.findFirst({
      where: { id, workspaceId: ctx.context.workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    const nextRead =
      typeof is_read === 'boolean' ? is_read : !existing.isRead;

    const updated = await db.notification.update({
      where: { id: existing.id },
      data: { isRead: nextRead },
    });

    return NextResponse.json({
      notification: sanitizeNotification(updated),
    });
  } catch (error) {
    console.error('[api/notifications/[id]] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/settings/notifications/[id]
 * Permanently delete a notification (scoped to the workspace).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing notification ID' }, { status: 400 });
    }

    const existing = await db.notification.findFirst({
      where: { id, workspaceId: ctx.context.workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    await db.notification.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/notifications/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
