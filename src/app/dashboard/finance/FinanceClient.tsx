'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  FileText,
  CreditCard,
  BarChart3,
  Download,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react';

interface LedgerEntry {
  id: string;
  direction: 'incoming' | 'outgoing';
  amount_cents: number;
  note: string;
  occurred_at: string;
  type: 'payment' | 'fee' | 'payout' | 'refund';
  gateway?: string;
}

interface FinanceData {
  totalIncoming: number;
  totalOutgoing: number;
  totalFees: number;
  netCash: number;
  grossRevenue: number;
  outstanding: number;
  overdue: number;
  ledger: LedgerEntry[];
  monthlyRevenue: { month: string; revenue: number; fees: number }[];
  feeBreakdown: { gateway: string; fee: number; count: number }[];
}

interface Props {
  workspaceId: string;
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

const GATEWAY_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  square: '⬜',
  adyen: '🔷',
  razorpay: '⚡',
  authorize_net: '🔐',
  braintree: '🔶',
  mollie: '🔵',
  custom: '🔌',
  manual: '✋',
};

const TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: any }
> = {
  payment: { label: 'Payment', bg: 'bg-green-500/15', text: 'text-green-400', icon: ArrowUpRight },
  fee: { label: 'Fee', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: ArrowDownRight },
  payout: { label: 'Payout', bg: 'bg-blue-500/15', text: 'text-blue-300', icon: ArrowDownRight },
  refund: { label: 'Refund', bg: 'bg-red-500/15', text: 'text-red-400', icon: ArrowDownRight },
};

export default function FinanceClient({ workspaceId }: Props) {
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/finance')
      .then((res) => res.json())
      .then((data) => {
        if (data.finance) setFinance(data.finance);
      })
      .catch((err) => console.error('Failed to fetch finance data:', err))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading || !finance) {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#10B981]/10 mb-4">
                <Activity className="w-6 h-6 text-[#10B981] animate-pulse" />
              </div>
              <p className="text-zinc-400 text-sm">Loading finance data...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const feePercentage =
    finance.totalIncoming > 0
      ? ((finance.totalFees / finance.totalIncoming) * 100).toFixed(2)
      : '0.00';

  const payouts = finance.ledger.filter((e) => e.type === 'payout').slice(0, 5);

  const insights: { icon: any; text: string; color: string; bg: string }[] = [];
  if (finance.grossRevenue > 0) {
    insights.push({
      icon: TrendingUp,
      text: `Gross revenue of ${toUsd(finance.grossRevenue)} collected from paid invoices.`,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    });
  }
  if (finance.totalFees > 0) {
    insights.push({
      icon: Percent,
      text: `Processing fees total ${toUsd(finance.totalFees)} (${feePercentage}% of gross volume).`,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    });
  }
  if (finance.netCash >= 0) {
    insights.push({
      icon: CheckCircle2,
      text: `Positive net cash flow of ${toUsd(finance.netCash)} after fees and payouts.`,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    });
  } else {
    insights.push({
      icon: AlertTriangle,
      text: `Negative net cash flow of ${toUsd(finance.netCash)} — payouts exceeded incoming revenue.`,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    });
  }
  if (finance.overdue > 0) {
    insights.push({
      icon: AlertTriangle,
      text: `${toUsd(finance.overdue)} in overdue invoices — follow up to improve cash flow.`,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    });
  }

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-dot-pulse" />
                {finance.ledger.length} ledger entries
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Financial Operations
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Cash ledger, revenue summary, processing fees, and payout tracking.
            </p>
          </div>
          <a
            href="/api/dashboard/export?type=transactions"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#131316] border border-[#252529] text-sm font-medium text-zinc-300 hover:text-[#10B981] hover:border-[#10B981]/30 transition-all w-fit"
          >
            <Download className="w-4 h-4" />
            Export Report
          </a>
        </div>

        {/* Key Financial Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-1">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-400">
                <TrendingUp className="w-3 h-3" />
              </span>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Gross Revenue
            </p>
            <p className="text-xl sm:text-2xl font-black text-green-400 animate-count">
              {toUsd(finance.grossRevenue)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">From paid invoices</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-2">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Net Cash Flow
            </p>
            <p
              className={`text-xl sm:text-2xl font-black animate-count ${
                finance.netCash >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {toUsd(finance.netCash)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">In — Out</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-3">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Outstanding
            </p>
            <p className="text-xl sm:text-2xl font-black text-blue-400 animate-count">
              {toUsd(finance.outstanding)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Pending invoices</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Processing Fees
            </p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 animate-count">
              {toUsd(finance.totalFees)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">{feePercentage}% of volume</p>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="mb-6 animate-fadeIn">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-[#10B981]" />
                </div>
                <h3 className="text-sm font-bold text-white">Financial Insights</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => {
                  const Icon = insight.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border ${insight.bg} animate-stagger stagger-${Math.min(i + 1, 4)}`}
                    >
                      <Icon className={`w-4 h-4 ${insight.color} flex-shrink-0 mt-0.5`} />
                      <p className="text-xs text-zinc-300 leading-relaxed">{insight.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Revenue + Fees Trend Chart */}
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Revenue & Fees Trend</h2>
                <p className="text-[11px] text-zinc-500">Last 6 months</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Revenue</p>
                <p className="text-sm font-black text-green-400">
                  {toUsd(finance.monthlyRevenue.reduce((s, m) => s + m.revenue, 0))}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Fees</p>
                <p className="text-sm font-black text-amber-400">
                  {toUsd(finance.monthlyRevenue.reduce((s, m) => s + m.fees, 0))}
                </p>
              </div>
            </div>
          </div>

          {finance.monthlyRevenue.some((m) => m.revenue > 0) ? (
            <div className="space-y-3">
              <div className="flex items-end gap-2 h-48">
                {finance.monthlyRevenue.map((m, i) => {
                  const maxRevenue = Math.max(...finance.monthlyRevenue.map((x) => x.revenue), 1);
                  const revHeight = Math.round((m.revenue / maxRevenue) * 100);
                  const feeHeight = m.revenue > 0 ? Math.round((m.fees / m.revenue) * revHeight) : 0;
                  return (
                    <div key={i} className="flex-1 group relative flex flex-col justify-end">
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-[#1a1a1f] border border-[#252529] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                          <p className="text-[10px] font-bold text-zinc-300">{m.month}</p>
                          <p className="text-[11px] text-green-400 font-semibold">
                            Rev: {toUsd(m.revenue)}
                          </p>
                          <p className="text-[11px] text-amber-400">
                            Fees: {toUsd(m.fees)}
                          </p>
                        </div>
                      </div>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[#10B981]/40 to-[#10B981]/80 group-hover:from-[#10B981]/60 group-hover:to-[#34D399] transition-all relative"
                        style={{ height: `${Math.max(revHeight, m.revenue > 0 ? 4 : 1)}%`, minHeight: '4px' }}
                      >
                        {feeHeight > 0 && (
                          <div
                            className="absolute top-0 left-0 right-0 rounded-t-md bg-amber-500/60"
                            style={{ height: `${feeHeight}%`, minHeight: '2px' }}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 text-center mt-1.5">{m.month}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 pt-3 border-t border-[#252529]/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-[#10B981]/40 to-[#10B981]/80" />
                  <span className="text-[10px] text-zinc-500">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/60" />
                  <span className="text-[10px] text-zinc-500">Processing fees</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <BarChart3 className="w-10 h-10 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No revenue data for this period</p>
              <p className="text-xs text-zinc-600 mt-1">
                Revenue will appear here once payments are processed
              </p>
            </div>
          )}
        </div>

        {/* Fee Breakdown + Cash Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Fee Breakdown */}
          <div className="glass-card rounded-2xl p-5 animate-fadeIn">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Fee Breakdown</h2>
                <p className="text-[11px] text-zinc-500">By gateway</p>
              </div>
            </div>

            {finance.feeBreakdown.length > 0 ? (
              <div className="space-y-2">
                {finance.feeBreakdown.map((fee, i) => {
                  const maxFee = finance.feeBreakdown[0]?.fee || 1;
                  const pct = Math.round((fee.fee / maxFee) * 100);
                  return (
                    <div key={fee.gateway} className={`animate-stagger stagger-${Math.min(i + 1, 5)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                          <span>{GATEWAY_ICONS[fee.gateway] || '🔗'}</span>
                          {fee.gateway}
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          {toUsd(fee.fee)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1a1a1f] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {fee.count} transaction{fee.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Percent className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No fee data</p>
              </div>
            )}
          </div>

          {/* Cash Ledger */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-5 animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Cash Ledger</h2>
                  <p className="text-[11px] text-zinc-500">{finance.ledger.length} entries</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full min-w-[500px] text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-[#131316] z-10">
                  <tr className="text-zinc-500 border-b border-[#252529]/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Type</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Amount
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Note</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252529]/30">
                  {finance.ledger.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">No ledger entries yet</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          Transactions will appear here once payments are processed
                        </p>
                      </td>
                    </tr>
                  )}
                  {finance.ledger.map((entry, i) => {
                    const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.payment;
                    const Icon = cfg.icon;
                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-white/5 transition-colors animate-stagger stagger-${Math.min((i % 6) + 1, 6)}`}
                      >
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 text-right font-semibold text-sm ${
                            entry.direction === 'incoming' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {entry.direction === 'incoming' ? '+' : '-'}
                          {toUsd(entry.amount_cents)}
                        </td>
                        <td className="py-2.5 text-zinc-400 text-xs max-w-[200px] truncate">
                          {entry.note || '—'}
                        </td>
                        <td className="py-2.5 text-right text-zinc-500 text-[11px]">
                          {new Date(entry.occurred_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Payouts */}
        <div className="glass-card rounded-2xl p-5 animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Recent Payouts</h2>
                <p className="text-[11px] text-zinc-500">{payouts.length} records</p>
              </div>
            </div>
          </div>

          {payouts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-zinc-500 border-b border-[#252529]/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">
                      Reference
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Amount
                    </th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Note</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252529]/30">
                  {payouts.map((payout, i) => (
                    <tr
                      key={payout.id}
                      className={`hover:bg-white/5 transition-colors animate-stagger stagger-${Math.min(i + 1, 5)}`}
                    >
                      <td className="py-3 font-mono text-zinc-400 text-xs">
                        {payout.id.slice(0, 12)}
                      </td>
                      <td className="py-3 text-right font-semibold text-red-400">
                        -{toUsd(payout.amount_cents)}
                      </td>
                      <td className="py-3 text-zinc-400 text-xs">{payout.note || 'Payout'}</td>
                      <td className="py-3 text-right text-zinc-500 text-xs">
                        {new Date(payout.occurred_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Wallet className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No payouts recorded yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Monthly payouts will appear here once revenue is collected
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
