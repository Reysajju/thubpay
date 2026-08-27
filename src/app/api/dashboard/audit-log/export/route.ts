// ─────────────────────────────────────────────────────────────
// Audit Log CSV Export
// GET /api/dashboard/audit-log/export?action=&entity=
//
// Exports the workspace's audit log entries as a CSV file.
// Supports the same action + entity filters as the audit-log page.
// Auth required (workspace-scoped).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  // Escape double quotes by doubling them, then wrap in quotes.
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(req.url);
  const actionFilter = url.searchParams.get('action');
  const entityFilter = url.searchParams.get('entity');
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');

  const where: {
    workspaceId: string;
    action?: string;
    entity?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    workspaceId: ctx.context.workspaceId,
  };
  if (actionFilter && actionFilter !== 'all') {
    where.action = actionFilter;
  }
  if (entityFilter && entityFilter !== 'all') {
    where.entity = entityFilter;
  }

  // Date range filter (same logic as the page).
  if (fromRaw || toRaw) {
    const dateRange: { gte?: Date; lte?: Date } = {};
    if (fromRaw) {
      const from = new Date(fromRaw + 'T00:00:00');
      if (!Number.isNaN(from.getTime())) dateRange.gte = from;
    }
    if (toRaw) {
      const to = new Date(toRaw + 'T23:59:59.999');
      if (!Number.isNaN(to.getTime())) dateRange.lte = to;
    }
    if (dateRange.gte || dateRange.lte) {
      where.createdAt = dateRange;
    }
  }

  try {
    const entries = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000, // cap to prevent huge downloads
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    // Build the CSV
    const headers = [
      'Timestamp',
      'Action',
      'Entity',
      'Entity ID',
      'User Email',
      'User Name',
      'Details (JSON)',
      'IP Address',
    ];

    const rows = entries.map((e) =>
      [
        formatDateTime(e.createdAt),
        e.action,
        e.entity || '',
        e.entityId || '',
        e.user?.email || '',
        e.user?.name || '',
        e.metadata || '',
        e.ipAddress || '',
      ]
        .map(csvEscape)
        .join(',')
    );

    const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');

    const filename = `thubpay-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[api/audit-log/export] error:', err);
    return NextResponse.json(
      { error: 'Failed to export audit log' },
      { status: 500 }
    );
  }
}
