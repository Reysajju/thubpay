'use client';

import { useState, useMemo, useEffect } from 'react';
import { Download, Search, Filter, X, ExternalLink, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, RotateCcw, Loader2, Calendar, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { processRefund } from '@/app/dashboard/actions';

export interface Transaction {
  id: string;
  invoice_id: string | null;
  gateway_slug: string;
  gateway_label: string | null;
  external_id: string | null;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
  failure_reason: string | null;
  customer_email: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  created_at: string;
}

interface Gateway {
  id: string;
  gateway_slug: string;
  label: string;
}

interface Props {
  transactions: Transaction[];
  gateways: Gateway[];
  stats: {
    totalVolume: number;
    succeededCount: number;
    failedCount: number;
    pendingCount: number;
    refundedCount: number;
    disputedCount: number;
    totalCount: number;
    successRate: number;
    avgAmount: number;
  };
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  succeeded: {
    label: 'Succeeded',
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/25',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/25',
    icon: XCircle,
  },
  pending: {
    label: 'Pending',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    icon: Clock,
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-300',
    border: 'border-cyan-500/25',
    icon: RefreshCw,
  },
  disputed: {
    label: 'Disputed',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/25',
    icon: AlertTriangle,
  },
};

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TransactionsTableClient({ transactions, gateways, stats }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('duplicate');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Unique gateway slugs from transactions + configured gateways
  const gatewaySlugs = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.gateway_slug));
    gateways.forEach((g) => set.add(g.gateway_slug));
    return Array.from(set).sort();
  }, [transactions, gateways]);

  const filtered = useMemo(() => {
    // Compute date range cutoff
    let dateCutoff: number | null = null;
    if (dateRange !== 'all') {
      const now = Date.now();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      dateCutoff = now - days * 86400000;
    }

    return transactions.filter((t) => {
      // Date range filter
      if (dateCutoff !== null) {
        const txDate = new Date(t.created_at).getTime();
        if (txDate < dateCutoff) return false;
      }
      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      // Gateway filter
      if (gatewayFilter !== 'all' && t.gateway_slug !== gatewayFilter) return false;
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          t.id,
          t.external_id,
          t.gateway_slug,
          t.gateway_label,
          t.customer_email,
          t.customer_name,
          t.invoice_number,
          t.failure_reason,
          t.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, gatewayFilter, search, dateRange]);

  const handleExport = (type: 'transactions' | 'invoices') => {
    window.open(`/api/dashboard/export?type=${type}`, '_blank');
  };

  const handleRefund = async () => {
    if (!selectedTx) return;
    const amount = parseFloat(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError('Enter a valid refund amount');
      return;
    }
    const amountCents = Math.round(amount * 100);
    if (amountCents > selectedTx.amount_cents) {
      setRefundError(`Amount cannot exceed ${toUsd(selectedTx.amount_cents)}`);
      return;
    }

    setRefundLoading(true);
    setRefundError(null);
    try {
      const result = await processRefund(selectedTx.id, amountCents, refundReason);
      if (result.success) {
        setRefundSuccess(true);
        setTimeout(() => {
          setSelectedTx(null);
          setShowRefundForm(false);
          setRefundAmount('');
          setRefundReason('duplicate');
          setRefundSuccess(false);
          window.location.reload();
        }, 1500);
      } else {
        setRefundError(result.error || 'Refund failed');
      }
    } catch {
      setRefundError('An unexpected error occurred');
    } finally {
      setRefundLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedTx(null);
    setShowRefundForm(false);
    setRefundAmount('');
    setRefundReason('duplicate');
    setRefundError(null);
    setRefundSuccess(false);
  };

  const hasFilters = search || statusFilter !== 'all' || gatewayFilter !== 'all' || dateRange !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setGatewayFilter('all');
    setDateRange('all');
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, gatewayFilter, dateRange]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filtered.length);

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Total Volume
            </span>
          </div>
          <p className="text-xl font-black text-white animate-count">{toUsd(stats.totalVolume)}</p>
          <p className="text-[11px] text-zinc-500 mt-1">{stats.succeededCount} successful</p>
        </div>

        <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Pending
            </span>
          </div>
          <p className="text-xl font-black text-amber-400 animate-count">{stats.pendingCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">awaiting settlement</p>
        </div>

        <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-green-400">{stats.successRate}%</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Success Rate
            </span>
          </div>
          <p className="text-xl font-black text-green-400 animate-count">{stats.successRate}%</p>
          <p className="text-[11px] text-zinc-500 mt-1">{stats.failedCount} failed</p>
        </div>

        <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-cyan-400">Avg</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Avg Amount
            </span>
          </div>
          <p className="text-xl font-black text-white animate-count">{toUsd(stats.avgAmount)}</p>
          <p className="text-[11px] text-zinc-500 mt-1">{stats.totalCount} total</p>
        </div>
      </div>

      {/* Filters + Export Bar */}
      <div className="glass-card rounded-2xl p-4 animate-fadeIn">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, customer, email, invoice..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all placeholder:text-zinc-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer appearance-none min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="succeeded">Succeeded</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>

          {/* Gateway Filter */}
          <div className="relative">
            <select
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer appearance-none min-w-[140px]"
            >
              <option value="all">All Gateways</option>
              {gatewaySlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {GATEWAY_ICONS[slug] || '🔗'} {slug}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer appearance-none min-w-[130px]"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('transactions')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-xs font-medium text-zinc-300 hover:text-[#10B981] hover:border-[#10B981]/30 transition-all whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Active filter indicator */}
        {hasFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#252529]/50">
            <span className="text-[11px] text-zinc-500">
              Showing {filtered.length} of {transactions.length} transactions
            </span>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] text-[#10B981] hover:text-[#34D399] transition-colors ml-auto"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#10B981]/10">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </span>
            <h2 className="text-lg font-bold text-white">Payment Transactions</h2>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
              {filtered.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-zinc-500 border-b border-[#252529]/60">
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Transaction</th>
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Customer</th>
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Gateway</th>
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Date</th>
                <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252529]/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800/50 mb-3">
                      <Search className="w-5 h-5 text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-400 font-medium">
                      {hasFilters ? 'No transactions match your filters' : 'No transactions yet'}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {hasFilters
                        ? 'Try adjusting your search or filters'
                        : 'Payment attempts will appear here once customers pay'}
                    </p>
                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-3 text-xs text-[#10B981] hover:text-[#34D399] transition-colors"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((tx, i) => {
                  const statusCfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-white/5 transition-colors cursor-pointer animate-stagger stagger-${Math.min(i + 1, 6)}`}
                    >
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-[#10B981] text-xs">
                            {tx.external_id || tx.id.slice(0, 12)}
                          </span>
                          {tx.invoice_number && (
                            <span className="text-[10px] text-zinc-600 mt-0.5">
                              {tx.invoice_number}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#10B981]/15 flex items-center justify-center text-[#10B981] font-bold text-[10px]">
                            {(tx.customer_name || tx.customer_email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-zinc-200 text-sm font-medium">
                              {tx.customer_name || 'Unknown'}
                            </p>
                            {tx.customer_email && (
                              <p className="text-zinc-600 text-[10px]">{tx.customer_email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className="font-semibold text-white text-sm">
                          {toUsd(tx.amount_cents)}
                        </span>
                        <span className="text-[10px] text-zinc-600 ml-1">{tx.currency}</span>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1a1a1f] border border-[#252529] text-xs font-bold text-zinc-300">
                          <span>{GATEWAY_ICONS[tx.gateway_slug] || '🔗'}</span>
                          {tx.gateway_label || tx.gateway_slug}
                        </span>
                      </td>
                      <td className="py-3 text-right text-zinc-400 text-xs">
                        {timeAgo(tx.created_at)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          className="text-xs text-zinc-500 hover:text-[#10B981] transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between pt-4 border-t border-[#252529]/40 mt-4">
            <p className="text-[11px] text-zinc-500">
              Showing <span className="text-zinc-300 font-medium">{startIdx + 1}</span>–
              <span className="text-zinc-300 font-medium">{endIdx}</span> of{' '}
              <span className="text-zinc-300 font-medium">{filtered.length}</span> transactions
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-[#1a1a1f] border border-[#252529] hover:border-[#10B981]/30 hover:text-[#10B981] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#252529] disabled:hover:text-zinc-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  page = currentPage - 2 + i;
                  if (page > totalPages) page = totalPages - 4 + i;
                }
                if (page < 1 || page > totalPages) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                        : 'text-zinc-400 bg-[#1a1a1f] border border-[#252529] hover:text-white hover:border-[#10B981]/30'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-[#1a1a1f] border border-[#252529] hover:border-[#10B981]/30 hover:text-[#10B981] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#252529] disabled:hover:text-zinc-300"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
          <div
            className="relative w-full max-w-lg bg-[#131316] rounded-2xl border border-[#252529] shadow-2xl overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#252529]/60 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#10B981]/10">
                  <span className="text-base">{GATEWAY_ICONS[selectedTx.gateway_slug] || '🔗'}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Transaction Details</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">{selectedTx.id}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {refundSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500/15 mb-3">
                    <CheckCircle2 className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-base font-bold text-white">Refund Processed</p>
                  <p className="text-xs text-zinc-500 mt-1">The transaction has been refunded successfully.</p>
                </div>
              ) : (
                <>
                  {/* Amount + Status */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0b] border border-[#252529]">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Amount
                      </p>
                      <p className="text-2xl font-black text-white">
                        {toUsd(selectedTx.amount_cents)}
                      </p>
                      <p className="text-[10px] text-zinc-500">{selectedTx.currency}</p>
                    </div>
                    {(() => {
                      const cfg = STATUS_CONFIG[selectedTx.status] || STATUS_CONFIG.pending;
                      const Icon = cfg.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="External ID" value={selectedTx.external_id || '—'} mono />
                    <DetailField label="Gateway" value={selectedTx.gateway_label || selectedTx.gateway_slug} />
                    <DetailField label="Customer" value={selectedTx.customer_name || '—'} />
                    <DetailField label="Email" value={selectedTx.customer_email || '—'} />
                    <DetailField
                      label="Invoice"
                      value={selectedTx.invoice_number || '—'}
                      link={selectedTx.invoice_id ? `/invoice/${selectedTx.invoice_id}` : null}
                    />
                    <DetailField label="Date" value={new Date(selectedTx.created_at).toLocaleString()} />
                  </div>

                  {/* Failure reason / refund info */}
                  {selectedTx.failure_reason && (
                    <div className={`p-3 rounded-xl border ${selectedTx.status === 'refunded' ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${selectedTx.status === 'refunded' ? 'text-cyan-400' : 'text-red-400'}`}>
                        {selectedTx.status === 'refunded' ? 'Refund Info' : 'Failure Reason'}
                      </p>
                      <p className={`text-sm ${selectedTx.status === 'refunded' ? 'text-cyan-300' : 'text-red-300'}`}>
                        {selectedTx.failure_reason}
                      </p>
                    </div>
                  )}

                  {/* Refund Form */}
                  {showRefundForm && selectedTx.status === 'succeeded' && (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3 animate-scaleIn">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-bold text-amber-400">Process Refund</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                          Refund Amount (USD)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={(selectedTx.amount_cents / 100).toFixed(2)}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder={(selectedTx.amount_cents / 100).toFixed(2)}
                            className="w-full pl-7 pr-3 py-2 rounded-lg bg-[#0a0a0b] border border-[#252529] text-sm text-white outline-none focus:border-amber-500/40 transition-all"
                          />
                        </div>
                        <button
                          onClick={() => setRefundAmount((selectedTx.amount_cents / 100).toFixed(2))}
                          className="text-[10px] text-amber-400 hover:text-amber-300 mt-1 transition-colors"
                        >
                          Use full amount ({toUsd(selectedTx.amount_cents)})
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                          Reason
                        </label>
                        <select
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0b] border border-[#252529] text-sm text-white outline-none focus:border-amber-500/40 transition-all cursor-pointer"
                        >
                          <option value="duplicate">Duplicate payment</option>
                          <option value="fraudulent">Fraudulent transaction</option>
                          <option value="requested_by_customer">Requested by customer</option>
                          <option value="product_unacceptable">Product/service unacceptable</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      {refundError && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400">{refundError}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowRefundForm(false)}
                          disabled={refundLoading}
                          className="flex-1 py-2 rounded-lg border border-[#252529] text-xs font-semibold text-zinc-300 hover:bg-white/5 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleRefund}
                          disabled={refundLoading}
                          className="flex-1 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {refundLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              Confirm Refund
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!refundSuccess && (
              <div className="px-6 py-4 border-t border-[#252529]/60 flex items-center justify-between flex-shrink-0">
                <span className="text-[10px] text-zinc-600">
                  Created {timeAgo(selectedTx.created_at)}
                </span>
                <div className="flex items-center gap-3">
                  {selectedTx.status === 'succeeded' && !showRefundForm && (
                    <button
                      onClick={() => setShowRefundForm(true)}
                      className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Refund
                    </button>
                  )}
                  {selectedTx.status === 'succeeded' && (
                    <a
                      href={`/api/public/receipt/${selectedTx.id}/pdf`}
                      download
                      className="flex items-center gap-1 text-xs font-medium text-[#10B981] hover:text-[#34D399] transition-colors"
                      title="Download receipt PDF"
                    >
                      <Download className="w-3 h-3" />
                      Receipt
                    </a>
                  )}
                  {selectedTx.status === 'refunded' && (
                    <a
                      href={`/api/public/credit-note/${selectedTx.id}/pdf`}
                      download
                      className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                      title="Download credit note PDF"
                    >
                      <Download className="w-3 h-3" />
                      Credit Note
                    </a>
                  )}
                  {selectedTx.invoice_id && (
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/pay/${selectedTx.invoice_id}`;
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(link);
                        }
                        // Show brief feedback
                        const btn = document.activeElement as HTMLButtonElement;
                        if (btn) {
                          const orig = btn.innerHTML;
                          btn.innerHTML = '<span class="flex items-center gap-1 text-xs text-[#10B981]"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</span>';
                          setTimeout(() => { btn.innerHTML = orig; }, 2000);
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-[#10B981] hover:text-[#34D399] transition-colors"
                      title="Copy payment link"
                    >
                      <Link2 className="w-3 h-3" />
                      Copy Link
                    </button>
                  )}
                  {selectedTx.invoice_id && (
                    <a
                      href={`/invoice/${selectedTx.invoice_id}`}
                      className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors"
                    >
                      View invoice
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string | null;
}) {
  return (
    <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      {link ? (
        <a
          href={link}
          className={`text-sm text-[#10B981] hover:text-[#34D399] transition-colors ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </a>
      ) : (
        <p className={`text-sm text-zinc-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
    </div>
  );
}
