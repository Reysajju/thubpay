import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
 * GET /api/dashboard/settings/notifications
 * List the most recent 50 notifications for the authenticated workspace.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    // Fetch the workspace's muted notification types so we can filter them out.
    const ws = await db.workspace.findUnique({
      where: { id: ctx.context.workspaceId },
      select: { mutedNotificationTypes: true },
    });
    const mutedTypes = ws?.mutedNotificationTypes
      ? ws.mutedNotificationTypes.split(',').filter(Boolean)
      : [];

    const rows = await db.notification.findMany({
      where: {
        workspaceId: ctx.context.workspaceId,
        // Exclude muted notification types from the response
        ...(mutedTypes.length > 0
          ? { type: { notIn: mutedTypes } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Compute unread count excluding muted types
    const unreadCount = rows.filter((r) => !r.isRead).length;

    return NextResponse.json({
      notifications: rows.map(sanitizeNotification),
      mutedTypes,
      unreadCount,
    });
  } catch (error) {
    console.error('[api/notifications] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/settings/notifications
 *
 * Mark notifications as read. Accepts one of:
 *   { markAllRead: true }            — mark every notification in the workspace as read
 *   { ids: ['notif_a', 'notif_b'] }  — mark only the listed notifications
 */
export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { ids, markAllRead } = body as {
      ids?: unknown;
      markAllRead?: unknown;
    };

    if (markAllRead === true) {
      const result = await db.notification.updateMany({
        where: {
          workspaceId: ctx.context.workspaceId,
          isRead: false,
        },
        data: { isRead: true },
      });
      return NextResponse.json({
        success: true,
        updated: result.count,
      });
    }

    if (Array.isArray(ids) && ids.every((i) => typeof i === 'string')) {
      if (ids.length === 0) {
        return NextResponse.json(
          { error: 'ids array must contain at least one notification ID' },
          { status: 400 }
        );
      }
      const result = await db.notification.updateMany({
        where: {
          workspaceId: ctx.context.workspaceId,
          id: { in: ids as string[] },
        },
        data: { isRead: true },
      });
      return NextResponse.json({
        success: true,
        updated: result.count,
      });
    }

    return NextResponse.json(
      { error: 'Provide either { markAllRead: true } or { ids: string[] }' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[api/notifications] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
