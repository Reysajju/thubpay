import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getTransactions, getTransactionStats, getTransactionVolume, getInvoices, getGateways } from '@/lib/demo-data';
import TransactionsTableClient from './TransactionsTableClient';
import TransactionVolumeChart from './TransactionVolumeChart';
import { FileText, CreditCard, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  sent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  viewed: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  paid: 'bg-green-500/15 text-green-400 border-green-500/25',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/25',
  void: 'bg-zinc-800 text-zinc-400 border-[#252529]',
};

export default async function TransactionsPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const [transactions, stats, invoices, gateways, volumeData] = await Promise.all([
    getTransactions(workspaceId, { limit: 200 }),
    getTransactionStats(workspaceId),
    getInvoices(workspaceId),
    getGateways(workspaceId),
    getTransactionVolume(workspaceId, 30),
  ]);

  // Invoice summary stats
  const totalInvoiced = invoices.reduce((s, inv) => s + (inv.total_cents || 0), 0);
  const paidAmount = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((s, inv) => s + (inv.total_cents || 0), 0);
  const pendingAmount = invoices
    .filter((inv) => ['draft', 'sent', 'viewed'].includes(inv.status))
    .reduce((s, inv) => s + (inv.total_cents || 0), 0);
  const overdueAmount = invoices
    .filter((inv) => inv.status === 'overdue')
    .reduce((s, inv) => s + (inv.total_cents || 0), 0);

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                <CreditCard className="w-3 h-3" />
                {transactions.length} payment records
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Transactions
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Real-time feed of all payment attempts across your connected gateways.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/dashboard/export?type=invoices"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#131316] border border-[#252529] text-sm font-medium text-zinc-300 hover:text-[#10B981] hover:border-[#10B981]/30 transition-all"
            >
              <Download className="w-4 h-4" />
              Export Invoices
            </a>
            <Link
              href="/dashboard"
              className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl text-[#111] text-sm font-bold shadow-lg shadow-[#10B981]/20"
            >
              <FileText className="w-4 h-4" />
              New Invoice
            </Link>
          </div>
        </div>

        {/* Transaction Volume Chart */}
        <div className="mb-6">
          <TransactionVolumeChart data={volumeData} />
        </div>

        {/* Payment Transactions Section */}
        <TransactionsTableClient
          transactions={transactions}
          gateways={gateways.map((g) => ({ id: g.id, gateway_slug: g.gateway_slug, label: g.label }))}
          stats={stats}
        />

        {/* Invoices Summary + Table */}
        <div className="mt-8">
          {/* Invoice Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-fadeIn">
            <div className="glass-card glass-card-hover rounded-2xl p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Total Invoiced
              </p>
              <p className="text-xl font-black text-white animate-count">{toUsd(totalInvoiced)}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{invoices.length} invoices</p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Paid</p>
              <p className="text-xl font-black text-green-400 animate-count">{toUsd(paidAmount)}</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {invoices.filter((i) => i.status === 'paid').length} invoices
              </p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Pending
              </p>
              <p className="text-xl font-black text-[#10B981] animate-count">{toUsd(pendingAmount)}</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {invoices.filter((i) => ['draft', 'sent', 'viewed'].includes(i.status)).length}{' '}
                invoices
              </p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Overdue
              </p>
              <p className="text-xl font-black text-red-400 animate-count">{toUsd(overdueAmount)}</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {invoices.filter((i) => i.status === 'overdue').length} invoices
              </p>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#10B981]" />
                <h2 className="text-lg font-bold text-white">All Invoices</h2>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                  {invoices.length}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-zinc-500 border-b border-[#252529]/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">
                      Invoice #
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Client</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Amount
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">
                      Status
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Date
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">
                      Gateway
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252529]/30">
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">No invoices found</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          Create your first invoice to get started
                        </p>
                      </td>
                    </tr>
                  )}
                  {invoices.map((inv, i) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-white/5 transition-colors group animate-stagger stagger-${Math.min(i + 1, 6)}`}
                    >
                      <td className="py-3">
                        <a
                          href={`/invoice/${inv.id}`}
                          className="font-mono text-[#10B981] text-xs hover:text-[#34D399] transition-colors"
                        >
                          {inv.invoice_number || inv.id?.slice(0, 8)}
                        </a>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#10B981]/15 flex items-center justify-center text-[#10B981] font-bold text-[10px]">
                            {(inv.clients?.name || inv.clients?.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-zinc-200 font-medium text-sm">
                              {inv.clients?.name || 'Unknown'}
                            </p>
                            {inv.clients?.email && (
                              <p className="text-zinc-600 text-[10px]">{inv.clients.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold text-white text-sm">
                        {toUsd(inv.total_cents)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            STATUS_STYLES[inv.status] || 'bg-zinc-800 text-zinc-400 border-[#252529]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-zinc-400 text-xs">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-[#1a1a1f] border border-[#252529] text-xs font-bold text-zinc-300 uppercase">
                          {inv.custom_payment_gateway || inv.paid_via_gateway || '—'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <a
                          href={`/invoice/${inv.id}`}
                          className="text-xs text-zinc-400 hover:text-[#10B981] transition-colors"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
