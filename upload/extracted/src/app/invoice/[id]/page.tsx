import { redirect } from 'next/navigation';
import { getInvoiceById, getInvoiceViews } from '@/lib/demo-data';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import InvoiceTrackingPixel from './components/InvoiceTrackingPixel';
import InvoiceActions from './components/InvoiceActions';
import { FileText, Calendar, User, Mail, Building2, CreditCard, ArrowLeft, Clock, CheckCircle2, XCircle, Send, Eye, DollarSign, EyeOff, MapPin, Monitor, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  draft: { label: 'Draft', bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/25', icon: FileText },
  sent: { label: 'Sent', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', icon: Send },
  viewed: { label: 'Viewed', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25', icon: Eye },
  paid: { label: 'Paid', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25', icon: CheckCircle2 },
  overdue: { label: 'Overdue', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25', icon: XCircle },
  void: { label: 'Void', bg: 'bg-zinc-800', text: 'text-zinc-500', border: 'border-[#252529]', icon: XCircle },
};

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Public invoice view — look up by id directly, no auth required.
  const invoice = await getInvoiceById(id);

  if (!invoice) redirect('/dashboard');

  // Check if current user is an authenticated merchant owner/member of this invoice
  const session = await auth();
  const sessionUserId = (session?.user as any)?.id;
  let isMerchant = false;
  if (sessionUserId) {
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId: invoice.workspaceId, userId: sessionUserId },
    });
    isMerchant = Boolean(member || sessionUserId === 'demo-admin-id');
  }

  const client = invoice.client;
  const workspace = invoice.workspace;
  const brandName = workspace?.name || 'ThubPay';
  const transactions = invoice.transactions || [];
  const invoiceViews = invoice.trackingToken && isMerchant ? await getInvoiceViews(id, 20) : [];
  const hasBeenViewed = (invoice.viewCount ?? 0) > 0;

  // Find the first succeeded transaction — used to enable the refund action
  // on paid invoices (merchants can issue full or partial refunds).
  const succeededTx = transactions.find((t: any) => t.status === 'succeeded') || null;

  // Build a payment timeline from the invoice history + transactions
  const timeline: { icon: any; label: string; date: string; color: string; detail?: string }[] = [];

  // Created
  timeline.push({
    icon: FileText,
    label: 'Invoice created',
    date: formatDateTime(invoice.createdAt),
    color: 'text-zinc-400',
    detail: `Draft status — ${invoice.invoiceNumber || id.slice(0, 8)}`,
  });

  // If sent/viewed/overdue, add that event
  if (['sent', 'viewed', 'overdue', 'paid'].includes(invoice.status)) {
    timeline.push({
      icon: Send,
      label: 'Invoice sent to client',
      date: formatDateTime(invoice.updatedAt),
      color: 'text-blue-300',
      detail: client?.email ? `Emailed to ${client.email}` : undefined,
    });
  }

  // If viewed
  if (['viewed', 'paid'].includes(invoice.status) || invoice.firstViewedAt) {
    timeline.push({
      icon: Eye,
      label: 'Client viewed invoice',
      date: formatDateTime(invoice.firstViewedAt ?? invoice.updatedAt),
      color: 'text-purple-400',
      detail: invoice.viewCount > 1 ? `Opened ${invoice.viewCount} times` : 'Opened the payment link',
    });
  }

  // Payment transactions
  for (const tx of transactions) {
    if (tx.status === 'succeeded') {
      timeline.push({
        icon: CheckCircle2,
        label: 'Payment received',
        date: formatDateTime(tx.createdAt),
        color: 'text-green-400',
        detail: `${toUsd(tx.amountCents)} via ${tx.gatewaySlug} · ${tx.externalId || tx.id.slice(0, 12)}`,
      });
    } else if (tx.status === 'failed') {
      timeline.push({
        icon: XCircle,
        label: 'Payment failed',
        date: formatDateTime(tx.createdAt),
        color: 'text-red-400',
        detail: tx.failureReason || `${toUsd(tx.amountCents)} via ${tx.gatewaySlug}`,
      });
    } else if (tx.status === 'refunded') {
      timeline.push({
        icon: DollarSign,
        label: 'Payment refunded',
        date: formatDateTime(tx.updatedAt),
        color: 'text-blue-400',
        detail: tx.failureReason || 'Full refund processed',
      });
    }
  }

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  // Check if overdue
  const isOverdue =
    invoice.status !== 'paid' &&
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* ── Invisible tracking pixel — fires on every render of this public page ── */}
      {invoice.trackingToken && <InvoiceTrackingPixel token={invoice.trackingToken} />}

      {/* Top nav bar */}
      <div className="sticky top-0 z-30 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-[#252529]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <a
            href={isMerchant ? "/dashboard/transactions" : "/"}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {isMerchant ? "Back to Dashboard" : "Back to ThubPay"}
          </a>
          <div className="flex items-center gap-2">
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              workspaceId={invoice.workspaceId}
              isMerchant={isMerchant}
              printOnly
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        {/* ── Link Tracking Banner (only for merchant viewing their own dispatched invoice) ── */}
        {isMerchant && invoice.sentAt && (
          <div
            className={`mb-6 rounded-2xl border p-4 sm:p-5 flex items-start gap-3 animate-fadeIn ${
              hasBeenViewed
                ? 'bg-[#10B981]/10 border-[#10B981]/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div
              className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                hasBeenViewed ? 'bg-[#10B981]/20' : 'bg-amber-500/20'
              }`}
            >
              {hasBeenViewed ? (
                <Eye className="w-5 h-5 text-[#34D399]" />
              ) : (
                <EyeOff className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p
                  className={`text-sm font-bold ${
                    hasBeenViewed ? 'text-[#34D399]' : 'text-amber-300'
                  }`}
                >
                  {hasBeenViewed ? 'Invoice has been viewed' : 'Invoice not yet opened'}
                </p>
                <span className="text-[11px] text-zinc-500">
                  {hasBeenViewed
                    ? `· ${invoice.viewCount} ${invoice.viewCount === 1 ? 'view' : 'views'}`
                    : '· waiting for client'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {hasBeenViewed
                  ? `First opened ${formatDateTime(invoice.firstViewedAt)}`
                  : `Sent ${formatDateTime(invoice.sentAt)}`}
                {hasBeenViewed && invoice.lastViewedAt && (
                  <> · Last viewed {formatDateTime(invoice.lastViewedAt)}</>
                )}
                {hasBeenViewed && invoice.lastViewerLocation && (
                  <> · {invoice.lastViewerLocation}</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 animate-fadeIn">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#34D399]">
                <FileText className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  {invoice.invoiceNumber || `Invoice #${id.slice(0, 8)}`}
                </h1>
                <p className="text-zinc-500 text-sm">{brandName}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {statusCfg.label}
            </span>
            {isOverdue && (
              <span className="text-[11px] font-semibold text-red-400">
                ⚠ Overdue by {Math.floor((Date.now() - new Date(invoice.dueDate!).getTime()) / 86400000)} days
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content — left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* From / To card */}
            <div className="glass-card rounded-2xl p-6 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* From */}
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" />
                    From
                  </p>
                  <p className="text-white font-semibold text-sm">{brandName}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Payment Portal</p>
                  <p className="text-zinc-600 text-[11px] mt-1">
                    {workspace?.plan === 'pro' ? 'Pro Plan' : workspace?.plan || 'Standard'}
                  </p>
                </div>
                {/* To */}
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    Bill To
                  </p>
                  <p className="text-white font-semibold text-sm">{client?.name || 'Client'}</p>
                  {client?.company && (
                    <p className="text-zinc-400 text-xs mt-0.5">{client.company}</p>
                  )}
                  {client?.email && (
                    <p className="text-zinc-500 text-[11px] mt-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {client.email}
                    </p>
                  )}
                  {client?.phone && (
                    <p className="text-zinc-500 text-[11px] mt-0.5">{client.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Line items / amount */}
            <div className="glass-card rounded-2xl p-6 animate-fadeIn">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#10B981]" />
                Amount Due
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-400">Invoice total</span>
                  <span className="text-white font-semibold">{toUsd(invoice.totalCents)}</span>
                </div>
                {invoice.customPaymentGateway && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" />
                      Payment method
                    </span>
                    <span className="text-zinc-300 font-medium uppercase text-xs">
                      {invoice.customPaymentGateway}
                    </span>
                  </div>
                )}
                <div className="border-t border-[#252529] pt-3 flex justify-between items-center">
                  <span className="text-white font-bold">Total Due</span>
                  <span className="text-[#34D399] font-black text-2xl">{toUsd(invoice.totalCents)}</span>
                </div>
              </div>
            </div>

            {/* Payment Timeline */}
            <div className="glass-card rounded-2xl p-6 animate-fadeIn">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#10B981]" />
                Payment Timeline
              </h2>
              {timeline.length === 0 ? (
                <p className="text-zinc-500 text-sm py-4 text-center">No activity yet</p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, i) => {
                    const Icon = event.icon;
                    const isLast = i === timeline.length - 1;
                    return (
                      <div key={i} className="flex gap-3 pb-4 last:pb-0 relative">
                        {/* Vertical line */}
                        {!isLast && (
                          <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[#252529]" />
                        )}
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1a1f] border border-[#252529] flex items-center justify-center ${event.color}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm font-semibold text-white">{event.label}</p>
                          {event.detail && (
                            <p className="text-xs text-zinc-500 mt-0.5">{event.detail}</p>
                          )}
                          <p className="text-[10px] text-zinc-600 mt-1">{event.date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="glass-card rounded-2xl p-6 animate-fadeIn">
                <h2 className="text-sm font-bold text-white mb-3">Notes</h2>
                <p className="text-zinc-400 text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Right sidebar — meta + actions */}
          <div className="space-y-4">
            {/* Meta card */}
            <div className="glass-card rounded-2xl p-5 animate-fadeIn">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                Invoice Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Due Date
                  </span>
                  <span className={`font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                    {formatDate(invoice.dueDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Created
                  </span>
                  <span className="text-zinc-300 font-medium">
                    {formatDate(invoice.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" />
                    Currency
                  </span>
                  <span className="text-zinc-300 font-medium">{invoice.currency}</span>
                </div>
                {transactions.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Attempts
                    </span>
                    <span className="text-zinc-300 font-medium">{transactions.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions card */}
            <div className="glass-card rounded-2xl p-5 animate-fadeIn">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                Actions
              </h3>
              <InvoiceActions
                invoiceId={invoice.id}
                status={invoice.status}
                workspaceId={invoice.workspaceId}
                transactionId={succeededTx?.id}
                transactionAmountCents={succeededTx?.amountCents}
                transactionCurrency={succeededTx?.currency || invoice.currency || 'USD'}
                invoiceNumber={invoice.invoiceNumber || undefined}
                isMerchant={isMerchant}
              />
            </div>

            {/* ── Link Tracking Summary (merchant only) ── */}
            {isMerchant && invoice.sentAt && (
              <div className="glass-card rounded-2xl p-5 animate-fadeIn">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Eye className="w-3 h-3" />
                  Link Tracking
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Send className="w-3 h-3" />
                      Sent
                    </span>
                    <span className="text-zinc-300 font-medium text-xs">
                      {formatDateTime(invoice.sentAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Eye className="w-3 h-3" />
                      Times opened
                    </span>
                    <span className={`font-bold ${hasBeenViewed ? 'text-[#34D399]' : 'text-zinc-400'}`}>
                      {invoice.viewCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      First view
                    </span>
                    <span className="text-zinc-300 font-medium text-xs">
                      {formatDateTime(invoice.firstViewedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Last view
                    </span>
                    <span className="text-zinc-300 font-medium text-xs">
                      {formatDateTime(invoice.lastViewedAt)}
                    </span>
                  </div>
                  {invoice.lastViewerLocation && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 flex items-center gap-1.5">
                        <Monitor className="w-3 h-3" />
                        Device
                      </span>
                      <span className="text-zinc-300 font-medium text-xs truncate max-w-[140px]" title={invoice.lastViewerLocation}>
                        {invoice.lastViewerLocation}
                      </span>
                    </div>
                  )}
                </div>

                {invoiceViews.length > 0 && (
                  <>
                    <div className="mt-4 pt-3 border-t border-[#252529]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          Recent Opens ({invoiceViews.length})
                        </p>
                        <a
                          href={`/api/dashboard/invoices/${invoice.id}/views/export`}
                          className="flex items-center gap-1 text-[10px] font-semibold text-[#10B981] hover:text-[#34D399] transition-colors group"
                          title="Download full view history as CSV"
                        >
                          <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                          CSV
                        </a>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                      {invoiceViews.map((v) => (
                        <div key={v.id} className="flex items-center gap-2 text-[11px] py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] flex-shrink-0" />
                          <span className="text-zinc-400 truncate flex-1" title={v.location || ''}>
                            {v.location || 'Unknown device'}
                          </span>
                          <span className="text-zinc-600 flex-shrink-0">
                            {new Date(v.viewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                            {new Date(v.viewedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Quick stats */}
            {transactions.length > 0 && (
              <div className="glass-card rounded-2xl p-5 animate-fadeIn">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                  Payment Activity
                </h3>
                <div className="space-y-2">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            tx.status === 'succeeded'
                              ? 'bg-green-400'
                              : tx.status === 'failed'
                              ? 'bg-red-400'
                              : tx.status === 'refunded'
                              ? 'bg-blue-400'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-zinc-400 truncate font-mono">
                          {tx.externalId || tx.id.slice(0, 12)}
                        </span>
                      </div>
                      <span className="text-zinc-300 font-medium flex-shrink-0 ml-2">
                        {toUsd(tx.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
