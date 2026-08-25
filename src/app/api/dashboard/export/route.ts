import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * GET /api/dashboard/export?type=transactions|invoices
 *
 * Exports workspace data as a CSV file download.
 * - type=transactions: payment attempts with gateway, status, customer
 * - type=invoices: invoices with client, amount, status, gateway
 */
export async function GET(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { workspaceId } = ctx.context;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'transactions';

  try {
    let csv = '';
    let filename = '';

    if (type === 'transactions') {
      const rows = await db.transaction.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: { gateway: true, invoice: true },
      });

      const headers = [
        'Transaction ID',
        'External ID',
        'Status',
        'Amount (USD)',
        'Currency',
        'Gateway',
        'Gateway Label',
        'Invoice Number',
        'Customer Name',
        'Customer Email',
        'Failure Reason',
        'Created At',
        'Updated At',
      ];
      csv = headers.join(',') + '\n';

      for (const t of rows) {
        csv += [
          escapeCsv(t.id),
          escapeCsv(t.externalId),
          escapeCsv(t.status),
          toUsd(t.amountCents),
          escapeCsv(t.currency),
          escapeCsv(t.gatewaySlug),
          escapeCsv(t.gateway?.label || ''),
          escapeCsv(t.invoice?.invoiceNumber || ''),
          escapeCsv(t.customerName),
          escapeCsv(t.customerEmail),
          escapeCsv(t.failureReason),
          escapeCsv(t.createdAt.toISOString()),
          escapeCsv(t.updatedAt.toISOString()),
        ].join(',') + '\n';
      }

      filename = `thubpay-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === 'invoices') {
      const rows = await db.invoice.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: { client: true },
      });

      const headers = [
        'Invoice ID',
        'Invoice Number',
        'Status',
        'Amount (USD)',
        'Currency',
        'Client Name',
        'Client Email',
        'Client Company',
        'Due Date',
        'Paid Via Gateway',
        'Custom Gateway',
        'Notes',
        'Created At',
        'Updated At',
      ];
      csv = headers.join(',') + '\n';

      for (const inv of rows) {
        csv += [
          escapeCsv(inv.id),
          escapeCsv(inv.invoiceNumber),
          escapeCsv(inv.status),
          toUsd(inv.totalCents),
          escapeCsv(inv.currency),
          escapeCsv(inv.client?.name || ''),
          escapeCsv(inv.client?.email || ''),
          escapeCsv(inv.client?.company || ''),
          escapeCsv(inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : ''),
          escapeCsv(inv.paidViaGateway),
          escapeCsv(inv.customPaymentGateway),
          escapeCsv(inv.notes),
          escapeCsv(inv.createdAt.toISOString()),
          escapeCsv(inv.updatedAt.toISOString()),
        ].join(',') + '\n';
      }

      filename = `thubpay-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      return NextResponse.json(
        { error: 'Invalid export type. Use ?type=transactions or ?type=invoices' },
        { status: 400 }
      );
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[api/export] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
