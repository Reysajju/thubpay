import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getInvoices } from '@/lib/demo-data';
import AnalyticsChartsClient from './AnalyticsChartsClient';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const invoices = await getInvoices(workspaceId);

  // Aggregate by status
  const grouped: Record<string, { status: string; count: number; total_cents: number }> = {};
  for (const inv of invoices) {
    const s = inv.status || 'draft';
    if (!grouped[s]) grouped[s] = { status: s, count: 0, total_cents: 0 };
    grouped[s].count += 1;
    grouped[s].total_cents += inv.total_cents || 0;
  }

  const statsArray = Object.values(grouped);

  return (
    <AnalyticsChartsClient
      invoiceStats={statsArray}
      workspaceId={workspaceId}
    />
  );
}
