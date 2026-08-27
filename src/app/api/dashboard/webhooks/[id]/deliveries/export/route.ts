// ─────────────────────────────────────────────────────────────
// CSV Export — Webhook Deliveries per Endpoint
// GET /api/dashboard/webhooks/[id]/deliveries/export
//
// Returns a CSV of every recorded delivery attempt to the given
// endpoint. Requires workspace ownership (the endpoint must belong
// to the caller's workspace).
//
// Top of CSV includes a comment-block summary:
//   # ThubPay — Webhook Delivery Export
//   # Endpoint: <label>
//   # URL: <url>
//   # Total Deliveries: N
//   # Successful: X (Y%)
//   # Avg Latency: Zms
//   # Exported At: <iso>
//
// CSV columns: attempted_at, status, status_code, duration_ms, error, event_id, event_type
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireWorkspace } from '@/lib/dashboard-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { workspaceId } = ctx.context;
  const { id } = await params;

  // Ownership check — endpoint must belong to this workspace.
  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      label: true,
      url: true,
      secret: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  }

  // Pull all deliveries for this endpoint (capped at 10000 for safety).
  const deliveries = await db.webhookDelivery.findMany({
    where: { webhookEndpointId: id, workspaceId },
    orderBy: { attemptedAt: 'desc' },
    take: 10000,
    include: {
      webhookEvent: {
        select: { id: true, eventType: true, createdAt: true },
      },
    },
  });

  // Compute summary stats
  const total = deliveries.length;
  const successful = deliveries.filter((d) => d.status === 'ok').length;
  const failed = deliveries.filter((d) => d.status === 'failed').length;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
  const latencies = deliveries
    .filter((d) => d.durationMs != null)
    .map((d) => d.durationMs!)
    .sort((a, b) => a - b);
  const avg =
    latencies.length > 0
      ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
      : null;
  const p95 =
    latencies.length > 0
      ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
      : null;
  const p99 =
    latencies.length > 0
      ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99))]
      : null;

  const safeLabel = endpoint.label.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40) || 'endpoint';

  const summaryLines = [
    `# ThubPay — Webhook Delivery Export`,
    `# Endpoint: ${endpoint.label}`,
    `# URL: ${endpoint.url}`,
    `# Active: ${endpoint.isActive ? 'yes' : 'no'}`,
    `# Subscribed Events: ${endpoint.events}`,
    `# Signed: ${endpoint.secret ? 'yes' : 'no'}`,
    `# Created At: ${endpoint.createdAt.toISOString()}`,
    `#`,
    `# Total Deliveries: ${total}`,
    `# Successful: ${successful} (${successRate}%)`,
    `# Failed: ${failed}`,
    `# Avg Latency: ${avg != null ? `${avg}ms` : 'n/a'}`,
    `# P95 Latency: ${p95 != null ? `${p95}ms` : 'n/a'}`,
    `# P99 Latency: ${p99 != null ? `${p99}ms` : 'n/a'}`,
    `# Exported At: ${new Date().toISOString()}`,
    `#`,
  ];

  const header = [
    'attempted_at',
    'status',
    'status_code',
    'duration_ms',
    'error',
    'event_id',
    'event_type',
    'event_created_at',
  ];

  const rows = deliveries.map((d) => [
    d.attemptedAt.toISOString(),
    d.status,
    d.statusCode != null ? String(d.statusCode) : '',
    d.durationMs != null ? String(d.durationMs) : '',
    d.error || '',
    d.webhookEvent?.id || '',
    d.webhookEvent?.eventType || '',
    d.webhookEvent?.createdAt ? d.webhookEvent.createdAt.toISOString() : '',
  ]);

  const csvLines = [
    ...summaryLines,
    header.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];
  const csv = csvLines.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="webhook-${safeLabel}-deliveries.csv"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
