import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getInvoices, getInvoiceViewStats, getInvoiceReminders, getInvoiceOpenHeatmap } from '@/lib/demo-data';
import ReminderPanel from '../components/ReminderPanel';
import InvoiceHeatmap from '../components/InvoiceHeatmap';
import OptimalSendTimeBanner from '../components/OptimalSendTimeBanner';
import BulkVoidButton from '../components/BulkVoidButton';
import BulkSelectProvider, {
  SelectAllCheckbox,
  RowCheckbox,
} from '../components/BulkSelectProvider';
import {
  MailCheck,
  Eye,
  EyeOff,
  Send,
  Clock,
  TrendingUp,
  FileText,
  ArrowUpRight,
  Bell,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── helpers ──────────────────────────────────────────────────

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
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
  // Older than ~4 weeks — fall back to a formatted date
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  sent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  viewed: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  paid: 'bg-green-500/15 text-green-400 border-green-500/25',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/25',
  void: 'bg-zinc-800 text-zinc-400 border-[#252529]',
};

function openRateColor(rate: number): string {
  if (rate >= 60) return 'text-green-400';
  if (rate >= 30) return 'text-amber-400';
  return 'text-red-400';
}

// ─── page ─────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default async function LinkTrackingPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const sp = await searchParams;
  const requestedPage = Math.max(1, parseInt(sp?.page || '1', 10) || 1);

  const [viewStats, invoices, reminders, heatmap] = await Promise.all([
    getInvoiceViewStats(workspaceId),
    getInvoices(workspaceId),
    getInvoiceReminders(workspaceId, 20),
    getInvoiceOpenHeatmap(workspaceId),
  ]);

  const { sentCount, viewedCount, notViewedCount, openRate, recentOpens } =
    viewStats;

  const totalInvoices = invoices.length;
  const openedPct = openRate; // % of sent that were opened
  const notOpenedPct = sentCount > 0 ? 100 - openedPct : 0;

  // Draft invoices — eligible for the "Void all drafts" bulk action.
  const draftInvoices = invoices.filter((inv: any) => inv.status === 'draft');
  const draftInvoiceIds = draftInvoices.map((inv: any) => inv.id);

  // Pagination for the All Invoices table
  const totalPages = Math.max(1, Math.ceil(totalInvoices / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalInvoices);
  const pagedInvoices = invoices.slice(pageStart, pageEnd);

  const statCards = [
    {
      label: 'Sent',
      value: String(sentCount),
      subtext: `${totalInvoices} total invoices`,
      icon: Send,
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-400',
      valueColor: 'text-white',
    },
    {
      label: 'Opened',
      value: String(viewedCount),
      subtext: sentCount > 0 ? `${openRate}% of sent` : '—',
      icon: Eye,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-[#34D399]',
      valueColor: 'text-[#34D399]',
    },
    {
      label: 'Not Opened',
      value: String(notViewedCount),
      subtext: 'Awaiting client',
      icon: EyeOff,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-400',
    },
    {
      label: 'Open Rate',
      value: `${openRate}%`,
      subtext:
        openRate >= 60
          ? 'Strong engagement'
          : openRate >= 30
            ? 'Room to improve'
            : sentCount > 0
              ? 'Low engagement'
              : 'No data yet',
      icon: TrendingUp,
      iconBg: 'bg-emerald-500/10',
      iconColor:
        openRate >= 60
          ? 'text-[#10B981]'
          : openRate >= 30
            ? 'text-amber-400'
            : 'text-red-400',
      valueColor: openRateColor(openRate),
    },
  ];

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                <MailCheck className="w-3 h-3" />
                {totalInvoices} invoices tracked
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Link Tracking
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              See exactly when clients open your invoices — no more guessing.
            </p>
          </div>
          {draftInvoiceIds.length > 0 && (
            <BulkVoidButton
              invoiceIds={draftInvoiceIds}
              label={`Void all drafts (${draftInvoiceIds.length})`}
            />
          )}
        </div>

        {/* Smart send-time recommendation banner */}
        <OptimalSendTimeBanner
          totalViews={heatmap.total_views}
          peakDay={heatmap.peak_day}
          peakHour={heatmap.peak_hour}
          peakCell={heatmap.peak_cell}
          cells={heatmap.cells}
        />

        {/* Stat cards row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className={`glass-card glass-card-hover stat-card-hover glass-card-press rounded-2xl p-4 sm:p-5 animate-stagger stagger-${i + 1}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-xl ${card.iconBg}`}
                >
                  <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                {card.label}
              </p>
              <p
                className={`text-xl sm:text-2xl font-black ${card.valueColor} animate-count tabular-nums`}
              >
                {card.value}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 truncate">
                {card.subtext}
              </p>
            </div>
          ))}
        </div>

        {/* Open Rate Visualization */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-base font-bold text-white">Open Rate</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                Opened {viewedCount}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                Not opened {notViewedCount}
              </span>
            </div>
          </div>

          {/* Segmented bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800/60 border border-[#252529]">
            <div
              className="h-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-700"
              style={{ width: `${Math.max(openedPct, sentCount > 0 ? 2 : 0)}%` }}
              aria-label={`${openedPct}% opened`}
            />
            <div
              className="h-full bg-zinc-700 transition-all duration-700"
              style={{ width: `${notOpenedPct}%` }}
              aria-label={`${notOpenedPct}% not opened`}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              {sentCount > 0
                ? `${viewedCount} of ${sentCount} sent invoices opened`
                : 'No sent invoices yet'}
            </span>
            <span className={`font-bold ${openRateColor(openRate)}`}>
              {openRate}% open rate
            </span>
          </div>
        </div>

        {/* All invoices table */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-lg font-bold text-white">All Invoices</h2>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                {totalInvoices}
              </span>
            </div>
          </div>

          <BulkSelectProvider
            invoices={pagedInvoices.map((inv: any) => ({ id: inv.id, status: inv.status }))}
          >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-zinc-500 border-b border-[#252529]/60">
                  <th className="pb-3 w-8">
                    <SelectAllCheckbox />
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">
                    Invoice #
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">
                    Client
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                    Amount
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">
                    Status
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">
                    Viewed
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">
                    Last Viewed
                  </th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252529]/30">
                {totalInvoices === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-sm text-zinc-500">No invoices yet</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        Create and send an invoice to start tracking opens.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pagedInvoices.map((inv, i) => {
                    const sentAt = inv.sent_at;
                    const viewed = (inv.view_count || 0) > 0;
                    const lastView = inv.last_viewed_at
                      ? formatRelative(inv.last_viewed_at)
                      : null;
                    const sentRel = sentAt ? formatRelative(sentAt) : null;

                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-white/5 transition-colors group animate-stagger stagger-${Math.min(i + 1, 6)}`}
                      >
                        <td className="py-3">
                          {['draft', 'sent', 'viewed', 'overdue'].includes(inv.status) ? (
                            <RowCheckbox id={inv.id} />
                          ) : (
                            <span className="block h-5 w-5" />
                          )}
                        </td>
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
                              {(
                                inv.clients?.name ||
                                inv.clients?.email ||
                                'U'
                              )[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-zinc-200 font-medium text-sm">
                                {inv.clients?.name || 'Unknown'}
                              </p>
                              {inv.clients?.email && (
                                <p className="text-zinc-600 text-[10px]">
                                  {inv.clients.email}
                                </p>
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
                          {!sentAt ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-zinc-600">Not sent</span>
                            </div>
                          ) : viewed ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/25 w-fit">
                                <Eye className="w-2.5 h-2.5" />
                                Viewed
                              </span>
                              <span className="text-[10px] text-zinc-600">
                                {inv.view_count}× · Last{' '}
                                {lastView || '—'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-500/15 text-amber-400 border-amber-500/25 w-fit">
                                <Clock className="w-2.5 h-2.5" />
                                Sent, not opened
                              </span>
                              <span className="text-[10px] text-zinc-600">
                                Sent {sentRel || '—'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          {lastView ? (
                            <span className="text-xs text-zinc-300">
                              {lastView}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <a
                            href={`/invoice/${inv.id}`}
                            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-[#10B981] transition-colors"
                          >
                            View
                            <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalInvoices > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#252529]/40">
              <p className="text-[11px] text-zinc-500 tabular-nums">
                Showing <span className="text-zinc-300 font-bold">{pageStart + 1}–{pageEnd}</span>{' '}
                of <span className="text-zinc-300 font-bold">{totalInvoices}</span> invoices
              </p>
              <div className="flex items-center gap-1">
                {currentPage > 1 ? (
                  <a
                    href={`/dashboard/link-tracking?page=${currentPage - 1}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 border border-[#252529] hover:border-[#10B981]/40 hover:text-[#10B981] transition-all flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Prev
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 border border-[#252529]/40 cursor-not-allowed flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3" />
                    Prev
                  </span>
                )}

                {/* Page number pills */}
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = idx + 1;
                    } else if (currentPage <= 4) {
                      pageNum = idx + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + idx;
                    } else {
                      pageNum = currentPage - 3 + idx;
                    }
                    const isActive = pageNum === currentPage;
                    return (
                      <a
                        key={pageNum}
                        href={`/dashboard/link-tracking?page=${pageNum}`}
                        className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center transition-all tabular-nums ${
                          isActive
                            ? 'bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-lg shadow-[#10B981]/20'
                            : 'text-zinc-400 border border-[#252529]/60 hover:border-[#10B981]/40 hover:text-[#10B981]'
                        }`}
                      >
                        {pageNum}
                      </a>
                    );
                  })}
                </div>

                {currentPage < totalPages ? (
                  <a
                    href={`/dashboard/link-tracking?page=${currentPage + 1}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 border border-[#252529] hover:border-[#10B981]/40 hover:text-[#10B981] transition-all flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 border border-[#252529]/40 cursor-not-allowed flex items-center gap-1">
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          )}
          </BulkSelectProvider>
        </div>

        {/* Recent opens list */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-[#34D399]" />
              <h2 className="text-lg font-bold text-white">Recent Opens</h2>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                {recentOpens.length}
              </span>
            </div>
            {recentOpens.length > 0 && (
              <a
                href="/dashboard/transactions"
                className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors group"
              >
                View all
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </div>

          {recentOpens.length === 0 ? (
            <div className="py-12 text-center">
              <MailCheck className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No invoice opens tracked yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Once a client opens an invoice you&apos;ve sent, you&apos;ll see it here.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-[#252529]/30">
              {recentOpens.slice(0, 10).map((open, i) => {
                const lastView = open.last_viewed_at
                  ? formatRelative(open.last_viewed_at)
                  : open.first_viewed_at
                    ? formatRelative(open.first_viewed_at)
                    : null;
                return (
                  <li
                    key={open.id}
                    className={`animate-stagger stagger-${Math.min(i + 1, 6)}`}
                  >
                    <a
                      href={`/invoice/${open.id}`}
                      className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      {/* Status indicator dot */}
                      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#10B981]/15 flex-shrink-0">
                        <Eye className="w-3.5 h-3.5 text-[#34D399]" />
                      </span>

                      {/* Invoice + client */}
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
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                          <Clock className="w-2.5 h-2.5" />
                          <span>
                            {lastView ? `Viewed ${lastView}` : 'Viewed'}
                          </span>
                          {open.last_viewer_location && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className="truncate">
                                {open.last_viewer_location}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* View count badge */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/10 text-[#34D399] border border-[#10B981]/20">
                          <Eye className="w-2.5 h-2.5" />
                          {open.view_count}×
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#10B981] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Invoice Open Heatmap */}
        <div className="mt-6">
          <InvoiceHeatmap
            cells={heatmap.cells}
            totalViews={heatmap.total_views}
            peakDay={heatmap.peak_day}
            peakHour={heatmap.peak_hour}
            peakCell={heatmap.peak_cell}
          />
        </div>

        {/* Auto-Reminder Panel */}
        <div className="mt-6">
          <ReminderPanel notViewedCount={notViewedCount} />
        </div>

        {/* Reminders History */}
        {reminders.length > 0 && (
          <div className="glass-card rounded-3xl p-4 sm:p-6 mt-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[#10B981]" />
                <h2 className="text-lg font-bold text-white">Reminders Sent</h2>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                  {reminders.length}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                Last {reminders.length} reminder{reminders.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-zinc-500 border-b border-[#252529]/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Type</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Invoice</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Client</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252529]/30">
                  {reminders.map((r, i) => {
                    const tierConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
                      unviewed: {
                        label: '1-day nudge',
                        bg: 'bg-amber-500/15',
                        text: 'text-amber-400',
                        border: 'border-amber-500/25',
                        icon: Bell,
                      },
                      followup: {
                        label: '3-day follow-up',
                        bg: 'bg-orange-500/15',
                        text: 'text-orange-400',
                        border: 'border-orange-500/25',
                        icon: AlertCircle,
                      },
                      final: {
                        label: 'Final + overdue',
                        bg: 'bg-red-500/15',
                        text: 'text-red-400',
                        border: 'border-red-500/25',
                        icon: AlertCircle,
                      },
                    };
                    const cfg = tierConfig[r.type] || tierConfig.unviewed;
                    const Icon = cfg.icon;
                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-white/5 transition-colors animate-stagger stagger-${Math.min(i + 1, 6)}`}
                      >
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            <Icon className="w-2.5 h-2.5" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3">
                          <a
                            href={`/invoice/${r.invoice_id}`}
                            className="font-mono text-[#10B981] text-xs hover:text-[#34D399] transition-colors"
                          >
                            {r.invoice_number || r.invoice_id.slice(0, 8)}
                          </a>
                        </td>
                        <td className="py-3 text-zinc-300 text-sm">
                          {r.client_name || 'Unknown'}
                        </td>
                        <td className="py-3 text-right font-semibold text-white text-sm tabular-nums">
                          {toUsd(r.total_cents)}
                        </td>
                        <td className="py-3 text-right text-zinc-400 text-xs tabular-nums">
                          {formatRelative(r.sent_at) || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
