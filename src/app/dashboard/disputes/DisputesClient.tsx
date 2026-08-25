'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  Activity,
  DollarSign,
  TrendingUp,
  X,
  ExternalLink,
  FileText,
  Calendar,
  CreditCard,
  User,
} from 'lucide-react';

interface Dispute {
  id: string;
  gateway_dispute_id: string;
  gateway_slug: string;
  gateway_label: string | null;
  reason: string;
  amount_cents: number;
  currency: string;
  status: 'needs_response' | 'under_review' | 'won' | 'lost' | 'chargeback';
  evidence_count: number;
  evidence_due_at: string | null;
  created_at: string;
  invoice_number: string | null;
  customer_email: string | null;
  customer_name: string | null;
}

interface DisputeStats {
  total: number;
  needsResponse: number;
  underReview: number;
  won: number;
  lost: number;
  totalDisputed: number;
  winRate: number;
  atRisk: number;
  disputes: Dispute[];
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

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  needs_response: { label: 'Needs Response', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25', icon: AlertTriangle },
  under_review: { label: 'Under Review', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', icon: Clock },
  won: { label: 'Won', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25', icon: CheckCircle2 },
  lost: { label: 'Lost', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25', icon: XCircle },
  chargeback: { label: 'Chargeback', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25', icon: XCircle },
};

const GATEWAY_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  square: '⬜',
  adyen: '🔷',
  razorpay: '⚡',
  manual: '✋',
};

const WORKFLOW_STEPS = [
  { step: 1, label: 'Dispute Filed', description: 'Customer initiates a chargeback via their bank or gateway.' },
  { step: 2, label: 'Evidence Collection', description: 'Gather transaction records, delivery confirmations, and communication logs.' },
  { step: 3, label: 'Submit Response', description: 'File your evidence with the payment gateway before the deadline.' },
  { step: 4, label: 'Resolution', description: 'Gateway reviews evidence and issues a final ruling — won or lost.' },
];

export default function DisputesClient({ workspaceId }: Props) {
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/disputes')
      .then((res) => res.json())
      .then((data) => {
        if (data.disputes) setStats(data);
      })
      .catch((err) => console.error('Failed to fetch disputes:', err))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading || !stats) {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#10B981]/10 mb-4">
                <Activity className="w-6 h-6 text-[#10B981] animate-pulse" />
              </div>
              <p className="text-zinc-400 text-sm">Loading disputes...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const filtered = statusFilter === 'all'
    ? stats.disputes
    : stats.disputes.filter((d) => d.status === statusFilter);

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <Shield className="w-3 h-3" />
              {stats.total} disputes
            </span>
            {stats.needsResponse > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                <AlertTriangle className="w-3 h-3" />
                {stats.needsResponse} need response
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Disputes & Chargebacks
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage payment disputes, submit evidence, and track resolution outcomes.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-1">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Needs Response
            </p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 animate-count">
              {stats.needsResponse}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Action required</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-2">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Amount at Risk
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#10B981] animate-count">
              {toUsd(stats.atRisk)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">In active disputes</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-3">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Win Rate
            </p>
            <p className="text-xl sm:text-2xl font-black text-green-400 animate-count">
              {stats.winRate}%
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {stats.won} won / {stats.lost} lost
            </p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Total Disputed
            </p>
            <p className="text-xl sm:text-2xl font-black text-white animate-count">
              {toUsd(stats.totalDisputed)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">{stats.total} disputes</p>
          </div>
        </div>

        {/* Dispute Workflow */}
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Dispute Resolution Process</h2>
              <p className="text-[11px] text-zinc-500">How chargebacks are resolved</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {WORKFLOW_STEPS.map((step, i) => (
              <div
                key={step.step}
                className={`p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50 animate-stagger stagger-${i + 1}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#10B981]/15 text-[#10B981] text-xs font-bold">
                    {step.step}
                  </span>
                  <p className="text-xs font-bold text-white">{step.label}</p>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter + Disputes List */}
        <div className="glass-card rounded-2xl p-5 animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">All Disputes</h2>
                <p className="text-[11px] text-zinc-500">{filtered.length} of {stats.disputes.length} shown</p>
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#1a1a1f] border border-[#252529] text-xs text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="needs_response">Needs Response</option>
              <option value="under_review">Under Review</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No disputes found</p>
              <p className="text-xs text-zinc-600 mt-1">
                {statusFilter !== 'all'
                  ? 'Try a different status filter'
                  : 'Disputes will appear here when customers file chargebacks'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((dispute, i) => {
                const cfg = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.needs_response;
                const StatusIcon = cfg.icon;
                const isUrgent =
                  dispute.status === 'needs_response' &&
                  dispute.evidence_due_at &&
                  new Date(dispute.evidence_due_at) > new Date() &&
                  (new Date(dispute.evidence_due_at).getTime() - Date.now()) < 7 * 86400000;

                return (
                  <div
                    key={dispute.id}
                    onClick={() => setSelectedDispute(dispute)}
                    className={`flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0b] border hover:border-[#10B981]/30 transition-all cursor-pointer animate-stagger stagger-${Math.min(i + 1, 6)} ${
                      isUrgent ? 'border-red-500/30' : 'border-[#252529]/50'
                    }`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1a1a1f] border border-[#252529] flex items-center justify-center text-base">
                      {GATEWAY_ICONS[dispute.gateway_slug] || '🔗'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono text-[#10B981] truncate">
                          {dispute.gateway_dispute_id}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {cfg.label}
                        </span>
                        {isUrgent && (
                          <span className="text-[9px] font-bold text-red-400 animate-pulse">
                            ⚠ URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">{dispute.reason}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {dispute.invoice_number && (
                          <span className="text-[10px] text-zinc-600">{dispute.invoice_number}</span>
                        )}
                        <span className="text-[10px] text-zinc-600">{timeAgo(dispute.created_at)}</span>
                        {dispute.evidence_count > 0 && (
                          <span className="text-[10px] text-zinc-600">{dispute.evidence_count} evidence files</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-white">{toUsd(dispute.amount_cents)}</p>
                      {dispute.evidence_due_at && dispute.status === 'needs_response' && (
                        <p className="text-[10px] text-red-400">Due {formatDate(dispute.evidence_due_at)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dispute Detail Drawer */}
      {selectedDispute && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setSelectedDispute(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
          <div
            className="relative w-full max-w-md bg-[#0d0d0e] border-l border-[#252529] h-full overflow-y-auto custom-scrollbar animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0d0d0e]/95 backdrop-blur-xl border-b border-[#252529] px-6 py-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Dispute Details</h2>
              <button
                onClick={() => setSelectedDispute(null)}
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              {/* Dispute ID + Status */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Dispute ID
                  </p>
                  <p className="text-sm font-mono text-[#10B981]">
                    {selectedDispute.gateway_dispute_id}
                  </p>
                </div>
                {(() => {
                  const cfg = STATUS_CONFIG[selectedDispute.status] || STATUS_CONFIG.needs_response;
                  const Icon = cfg.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              {/* Amount */}
              <div className="p-4 rounded-xl bg-[#0a0a0b] border border-[#252529]">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Disputed Amount
                </p>
                <p className="text-2xl font-black text-white">
                  {toUsd(selectedDispute.amount_cents)}
                </p>
                <p className="text-[10px] text-zinc-500">{selectedDispute.currency}</p>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Gateway
                  </p>
                  <p className="text-sm text-zinc-200">
                    {GATEWAY_ICONS[selectedDispute.gateway_slug] || '🔗'} {selectedDispute.gateway_label || selectedDispute.gateway_slug}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Filed
                  </p>
                  <p className="text-sm text-zinc-200">{formatDate(selectedDispute.created_at)}</p>
                </div>
                {selectedDispute.evidence_due_at && (
                  <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Evidence Due
                    </p>
                    <p className="text-sm text-red-400">{formatDate(selectedDispute.evidence_due_at)}</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Evidence
                  </p>
                  <p className="text-sm text-zinc-200">{selectedDispute.evidence_count} files</p>
                </div>
              </div>

              {/* Reason */}
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Dispute Reason
                </p>
                <p className="text-sm text-zinc-300">{selectedDispute.reason}</p>
              </div>

              {/* Customer info (if available) */}
              {(selectedDispute.customer_name || selectedDispute.customer_email || selectedDispute.invoice_number) && (
                <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Customer Information
                  </p>
                  {selectedDispute.customer_name && (
                    <p className="text-sm text-zinc-200 flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-zinc-500" />
                      {selectedDispute.customer_name}
                    </p>
                  )}
                  {selectedDispute.customer_email && (
                    <p className="text-xs text-zinc-500">{selectedDispute.customer_email}</p>
                  )}
                  {selectedDispute.invoice_number && (
                    <a
                      href="#"
                      className="text-xs text-[#10B981] hover:text-[#34D399] mt-1 inline-flex items-center gap-1"
                    >
                      {selectedDispute.invoice_number}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              {selectedDispute.status === 'needs_response' && (
                <div className="space-y-2">
                  <button className="w-full btn-gradient flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-black text-sm font-bold transition-all">
                    <Upload className="w-4 h-4" />
                    Submit Evidence
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#252529] text-sm font-medium text-zinc-300 hover:bg-white/5 transition-all">
                    <FileText className="w-4 h-4" />
                    Accept Dispute
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
