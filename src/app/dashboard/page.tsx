import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireWorkspace } from '@/lib/dashboard-auth';
import {
  getDashboardStats,
  getRecentInvoices,
  getMonthlyRevenue,
  getClients,
  getInvoiceViewStats,
} from '@/lib/demo-data';
import DashboardActions from './components/DashboardActions';
import DashboardOverviewCharts from './components/DashboardOverviewCharts';
import ManualPaidButton from './components/ManualPaidButton';
import MonthlyTargetWidget from './components/MonthlyTargetWidget';
import RecentActivityTimeline from './components/RecentActivityTimeline';
import { DollarSign, Clock, CheckCircle2, Users, TrendingUp, ArrowUpRight, FileText, Eye, MailCheck, Inbox, Plus, Calendar, CalendarDays, CalendarRange, Receipt } from 'lucide-react';

export const dynamic = 'force-dynamic';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

function formatRelative(date: string | Date | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'Just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400 border-green-500/25',
  sent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  viewed: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/25',
  draft: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  void: 'bg-zinc-800 text-zinc-400 border-[#252529]',
};

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId, workspace, user } = ctx.context;

  const [stats, recentInvoices, monthlyRevenue, clients, viewStats] = await Promise.all([
    getDashboardStats(workspaceId),
    getRecentInvoices(workspaceId, 8),
    getMonthlyRevenue(workspaceId),
    getClients(workspaceId),
    getInvoiceViewStats(workspaceId),
  ]);

  const openedPct = viewStats.openRate;
  const notOpenedPct = viewStats.sentCount > 0 ? 100 - openedPct : 0;
  const recentOpensTop5 = viewStats.recentOpens.slice(0, 5);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email ?? undefined,
    company: c.company ?? undefined,
  }));

  const pendingCount = recentInvoices.filter((i) =>
    ['sent', 'viewed'].includes(i.status)
  ).length;

  const statCards = [
    {
      label: 'Total Revenue',
      value: toUsd(stats.totalRevenue),
      subtext: stats.revenueChangePct === 0
        ? 'No change vs last month'
        : `${stats.revenueChangePct > 0 ? '+' : ''}${stats.revenueChangePct}% from last month`,
      trendChip: stats.revenueChangeAbs !== 0
        ? `${stats.revenueChangeAbs > 0 ? '+' : ''}${toUsd(stats.revenueChangeAbs)}`
        : null,
      icon: DollarSign,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      valueColor: 'text-white',
      trend: (stats.revenueChangePct > 0 ? 'up' : stats.revenueChangePct < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
    },
    {
      label: 'Pending',
      value: toUsd(stats.pendingAmount),
      subtext: `${pendingCount} invoices`,
      trendChip: stats.overdueAmount > 0 ? `${toUsd(stats.overdueAmount)} overdue` : null,
      icon: Clock,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-400',
      trend: 'neutral' as const,
    },
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      subtext: `${stats.paidCount} of ${stats.totalCount} invoices`,
      trendChip: null,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-400',
      trend: (stats.successRate >= 80 ? 'up' : stats.successRate >= 50 ? 'neutral' : 'down') as 'up' | 'down' | 'neutral',
    },
    {
      label: 'Active Clients',
      value: String(stats.clientCount),
      subtext: `${stats.activeGateways} gateways connected`,
      trendChip: stats.newClientsThisMonth > 0
        ? `+${stats.newClientsThisMonth} this month`
        : null,
      icon: Users,
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-400',
      valueColor: 'text-white',
      trend: (stats.newClientsThisMonth > 0 ? 'up' : 'neutral') as 'up' | 'down' | 'neutral',
    },
  ];

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-30 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-dot-pulse" />
                All systems operational
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Here&apos;s what&apos;s happening with your payments today.
            </p>
          </div>
          <DashboardActions workspaceId={workspaceId} clients={clientOptions} />
        </div>

        {/* Quick-Stats Strip — Today / MTD / YTD breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6 animate-fadeIn">
          {[
            {
              label: "Today's Revenue",
              value: toUsd(stats.todayRevenue),
              caption: `${stats.todayTransactionCount} ${stats.todayTransactionCount === 1 ? 'payment' : 'payments'}`,
              Icon: Calendar,
              accent: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20 text-emerald-300',
              iconBg: 'bg-emerald-500/10 text-emerald-400',
            },
            {
              label: 'MTD Revenue',
              value: toUsd(stats.mrr),
              caption: `${stats.paidCount} paid invoices`,
              Icon: CalendarDays,
              accent: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20 text-cyan-300',
              iconBg: 'bg-cyan-500/10 text-cyan-400',
            },
            {
              label: 'YTD Revenue',
              value: toUsd(stats.ytdRevenue),
              caption: `${new Date().getFullYear()} year-to-date`,
              Icon: CalendarRange,
              accent: 'from-amber-500/15 to-amber-500/5 border-amber-500/20 text-amber-300',
              iconBg: 'bg-amber-500/10 text-amber-400',
            },
            {
              label: 'Avg per Invoice',
              value: toUsd(stats.paidCount > 0 ? stats.totalRevenue / stats.paidCount : 0),
              caption: `${stats.paidCount} paid · ${stats.totalCount - stats.paidCount} pending`,
              Icon: Receipt,
              accent: 'from-purple-500/15 to-purple-500/5 border-purple-500/20 text-purple-300',
              iconBg: 'bg-purple-500/10 text-purple-400',
            },
          ].map((chip, i) => {
            const Icon = chip.Icon;
            return (
              <div
                key={chip.label}
                className={`relative overflow-hidden rounded-2xl p-3.5 border bg-gradient-to-br ${chip.accent} animate-stagger stagger-${i + 1} stat-card-hover`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {chip.label}
                  </span>
                  <div className={`flex items-center justify-center w-6 h-6 rounded-lg ${chip.iconBg}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-black tabular-nums animate-count">
                  {chip.value}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{chip.caption}</p>
              </div>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {statCards.map((card, i) => {
            const isUp = card.trend === 'up';
            const isDown = card.trend === 'down';
            const trendColor = isUp
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : isDown
                ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
            return (
              <div
                key={card.label}
                className={`glass-card glass-card-hover stat-card-hover glass-card-press rounded-2xl p-4 sm:p-5 animate-stagger stagger-${i + 1} relative overflow-hidden`}
              >
                {/* Decorative gradient blob in the corner */}
                <div
                  className={`pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 ${card.iconBg}`}
                />
                <div className="flex items-start justify-between mb-3 relative">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${card.iconBg} border border-white/5`}>
                    <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                  {(isUp || isDown) && (
                    <span
                      className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${trendColor}`}
                      title={`Trend: ${card.trend}`}
                    >
                      {isUp ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3 rotate-90" />
                      )}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  {card.label}
                </p>
                <p className={`text-xl sm:text-2xl font-black ${card.valueColor} animate-count tabular-nums`}>
                  {card.value}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 truncate">{card.subtext}</p>
                {card.trendChip && (
                  <p
                    className={`mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${trendColor}`}
                  >
                    {card.trendChip}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Charts + Target */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 animate-fadeIn">
          <div className="lg:col-span-2">
            <DashboardOverviewCharts
              revenueData={monthlyRevenue.map((d) => ({ month: d.date, amount: d.amount }))}
              ledgerData={[]}
              invoiceStats={[]}
            />
          </div>
          <MonthlyTargetWidget
            currentRevenueCents={stats.totalRevenue}
            targetCents={workspace.monthlyTargetCents || 500000}
          />
        </div>

        {/* Recent Invoices + Activity Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 animate-fadeIn">
          <div className="lg:col-span-2 glass-card rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#10B981]" />
                <h2 className="text-lg font-bold text-white">Recent Invoices</h2>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                  {recentInvoices.length}
                </span>
              </div>
              <Link
                href="/dashboard/transactions"
                className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors group"
              >
                View all
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-zinc-500 border-b border-[#252529]/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Invoice</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Client</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252529]/30">
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center">
                            <Inbox className="w-5 h-5 text-[#10B981]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-300">No invoices yet</p>
                            <p className="text-xs text-zinc-600 mt-1">
                              Your recent invoices will appear here once created.
                            </p>
                          </div>
                          <Link
                            href="/dashboard/settings/gateways"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2e2e33] bg-[#18181c] hover:border-[#3e3e44] hover:bg-[#1d1d22] text-zinc-200 text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#10B981]" />
                            Connect a gateway to get started
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((inv, i) => (
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
                              <p className="text-zinc-200 text-sm font-medium">
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
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/invoice/${inv.id}`}
                              className="text-xs text-zinc-400 hover:text-[#10B981] transition-colors"
                            >
                              View
                            </a>
                            <ManualPaidButton invoiceId={inv.id} status={inv.status} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-1">
            <RecentActivityTimeline />
          </div>
        </div>

        {/* Link Tracking Mini-Widget */}
        {viewStats.recentOpens.length > 0 && (
          <div className="glass-card rounded-3xl p-4 sm:p-6 mt-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-[#34D399]" />
                <h2 className="text-lg font-bold text-white">Recent Invoice Opens</h2>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                  {viewStats.recentOpens.length}
                </span>
              </div>
              <Link
                href="/dashboard/link-tracking"
                className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors group"
              >
                View all
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            {/* Open rate + sent summary row */}
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-zinc-400">
                Open Rate:{' '}
                <span
                  className={`font-bold ${viewStats.openRate >= 60 ? 'text-green-400' : viewStats.openRate >= 30 ? 'text-amber-400' : 'text-red-400'}`}
                >
                  {viewStats.openRate}%
                </span>
              </span>
              <span className="text-xs text-zinc-500">
                <span className="text-[#34D399] font-semibold">{viewStats.viewedCount} opened</span>
                {' / '}
                <span className="text-zinc-400">{viewStats.sentCount} sent</span>
              </span>
            </div>

            {/* Horizontal bar visualization */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/60 border border-[#252529] mb-5">
              <div
                className="h-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-700"
                style={{ width: `${Math.max(openedPct, viewStats.sentCount > 0 ? 2 : 0)}%` }}
              />
              <div
                className="h-full bg-zinc-700 transition-all duration-700"
                style={{ width: `${notOpenedPct}%` }}
              />
            </div>

            {/* List of the 5 most recent opens */}
            <ul className="divide-y divide-[#252529]/30">
              {recentOpensTop5.map((open, i) => {
                const lastView = open.last_viewed_at
                  ? formatRelative(open.last_viewed_at)
                  : open.first_viewed_at
                    ? formatRelative(open.first_viewed_at)
                    : null;
                return (
                  <li
                    key={open.id}
                    className={`animate-stagger stagger-${i + 1}`}
                  >
                    <a
                      href={`/invoice/${open.id}`}
                      className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#10B981]/15 flex-shrink-0">
                        <MailCheck className="w-3.5 h-3.5 text-[#34D399]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#10B981] group-hover:text-[#34D399] transition-colors truncate">
                            {open.invoice_number || open.id.slice(0, 8)}
                          </span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-sm text-zinc-200 font-medium truncate">
                            {open.client_name || open.client_email || 'Unknown client'}
                          </span>
                        </div>
                        {lastView && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            viewed {lastView}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/10 text-[#34D399] border border-[#10B981]/20 flex-shrink-0">
                        <Eye className="w-2.5 h-2.5" />
                        {open.view_count}×
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
