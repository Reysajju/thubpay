// ─────────────────────────────────────────────────────────────
// CSV Export — Invoice View History
// GET /api/dashboard/invoices/[id]/views/export
//
// Returns a CSV of every recorded view of the invoice. Requires
// workspace ownership (the invoice must belong to the caller's
// workspace).
//
// Columns: viewed_at, ip_address, user_agent, referrer, location
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireWorkspace } from '@/lib/dashboard-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote if it contains comma, quote, newline, or leading/trailing whitespace.
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

  // Ownership check — the invoice must belong to this workspace.
  const invoice = await db.invoice.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      invoiceNumber: true,
      totalCents: true,
      currency: true,
      sentAt: true,
      firstViewedAt: true,
      lastViewedAt: true,
      viewCount: true,
      status: true,
      client: { select: { name: true, email: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const views = await db.invoiceView.findMany({
    where: { invoiceId: id },
    orderBy: { viewedAt: 'desc' },
    take: 5000, // hard cap for safety
  });

  const invoiceLabel = invoice.invoiceNumber || id.slice(0, 8);
  const safeInvoiceLabel = invoiceLabel.replace(/[^a-zA-Z0-9-_]/g, '_');

  // Build CSV
  const header = [
    'viewed_at',
    'ip_address',
    'user_agent',
    'referrer',
    'location',
  ];
  const rows = views.map((v) => [
    v.viewedAt.toISOString(),
    v.ipAddress,
    v.userAgent,
    v.referrer,
    v.location,
  ]);

  // Prepend an invoice summary block as a comment block at the top
  // (lines starting with `#` are commonly ignored by CSV parsers).
  const summaryLines = [
    `# ThubPay — Invoice View History Export`,
    `# Invoice: ${invoiceLabel}`,
    `# Client: ${invoice.client?.name || 'Unknown'}${invoice.client?.email ? ` <${invoice.client.email}>` : ''}`,
    `# Status: ${invoice.status}`,
    `# Total: ${invoice.totalCents / 100} ${invoice.currency}`,
    `# Sent At: ${invoice.sentAt ? invoice.sentAt.toISOString() : 'Not sent'}`,
    `# First Viewed: ${invoice.firstViewedAt ? invoice.firstViewedAt.toISOString() : 'Never'}`,
    `# Last Viewed: ${invoice.lastViewedAt ? invoice.lastViewedAt.toISOString() : 'Never'}`,
    `# Total Views: ${invoice.viewCount}`,
    `# Exported At: ${new Date().toISOString()}`,
    `#`,
  ];

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
      'Content-Disposition': `attachment; filename="invoice-${safeInvoiceLabel}-views.csv"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
