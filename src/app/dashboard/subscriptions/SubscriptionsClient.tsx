'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  CreditCard,
  Calendar,
  RefreshCw,
  Clock,
  Users,
  ArrowUpRight,
  AlertTriangle,
  Repeat,
  CheckCircle2,
  PauseCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Plus,
  Play,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

interface Subscription {
  id: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  plan_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  cycle: string;
  gateway_slug: string | null;
  gateway_label: string | null;
  next_billing_at: string | null;
  started_at: string;
  canceled_at: string | null;
}

interface Props {
  workspaceId: string;
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

// Convert an amount based on its cycle into its monthly equivalent (MRR contribution).
function toMonthly(amountCents: number, cycle: string): number {
  const c = (cycle || 'monthly').toLowerCase();
  if (c === 'quarterly') return amountCents / 3;
  if (c === 'yearly' || c === 'annual') return amountCents / 12;
  return amountCents;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  active: { label: 'Active', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25', icon: CheckCircle2 },
  past_due: { label: 'Past Due', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25', icon: XCircle },
  canceled: { label: 'Canceled', bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/25', icon: XCircle },
  paused: { label: 'Paused', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25', icon: PauseCircle },
  trialing: { label: 'Trialing', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', icon: Clock },
};

const GATEWAY_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  square: '⬜',
  adyen: '🔷',
  razorpay: '⚡',
  manual: '✋',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Subscriptions' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'paused', label: 'Paused' },
];

export default function SubscriptionsClient({ workspaceId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Subscription Form State
  const [planName, setPlanName] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [customInterval, setCustomInterval] = useState('14');
  const [customUnit, setCustomUnit] = useState('days');
  const [trialDays, setTrialDays] = useState('0');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSubscriptions = () => {
    fetch('/api/dashboard/subscriptions')
      .then((res) => res.json())
      .then((data) => {
        if (data.subscriptions) setSubscriptions(data.subscriptions);
      })
      .catch((err) => console.error('Failed to fetch subscriptions:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [workspaceId]);

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !amountUsd) return;

    const finalCycle = cycle === 'custom' ? `every ${customInterval} ${customUnit}` : cycle;

    setSubmitting(true);
    try {
      const res = await fetch('/api/dashboard/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: planName,
          amount_usd: amountUsd,
          cycle: finalCycle,
          trial_days: Number(trialDays) || 0,
          client_name: clientName || undefined,
          client_email: clientEmail || undefined,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setPlanName('');
        setAmountUsd('');
        setClientName('');
        setClientEmail('');
        fetchSubscriptions();
      }
    } catch (err) {
      console.error('Error creating subscription:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/dashboard/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setSubscriptions((prev) =>
          prev ? prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)) : []
        );
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const copyRecurringLink = (sub: Subscription) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/pay/${sub.id}?plan=${encodeURIComponent(sub.plan_name)}&recur=${sub.cycle}`;
    navigator.clipboard.writeText(link);
    setCopiedId(sub.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const subs = subscriptions || [];
    const active = subs.filter((s) => s.status === 'active');
    const mrr = active.reduce((sum, s) => sum + toMonthly(s.amount_cents, s.cycle), 0);
    const pastDue = subs.filter((s) => s.status === 'past_due').length;
    return {
      activeCount: active.length,
      mrr,
      pastDueCount: pastDue,
      totalSubscribers: subs.length,
    };
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const subs = subscriptions || [];
    if (statusFilter === 'all') return subs;
    return subs.filter((s) => s.status === statusFilter);
  }, [subscriptions, statusFilter]);

  if (loading || subscriptions === null) {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#10B981]/10 mb-4">
                <Activity className="w-6 h-6 text-[#10B981] animate-pulse" />
              </div>
              <p className="text-zinc-400 text-sm">Loading subscriptions...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const hasData = subscriptions.length > 0;

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                <Repeat className="w-3 h-3" />
                {stats.activeCount} active
              </span>
              {stats.pastDueCount > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  {stats.pastDueCount} past due
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Subscriptions
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Manage recurring billing, plan lifecycles, and churn prevention.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer"
          >
            <Repeat className="w-4 h-4" />
            <span>Create Recurring Plan</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-1">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Active Count
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#10B981] animate-count">
              {stats.activeCount}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Recurring customers</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-2">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              MRR
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#10B981] animate-count">
              {toUsd(stats.mrr)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Monthly recurring revenue</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-3">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Past Due
            </p>
            <p className="text-xl sm:text-2xl font-black text-red-400 animate-count">
              {stats.pastDueCount}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Needs attention</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-300" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Total Subscribers
            </p>
            <p className="text-xl sm:text-2xl font-black text-white animate-count">
              {stats.totalSubscribers}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">All subscriptions</p>
          </div>
        </div>

        {/* Filter Bar */}
        {hasData && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Filter:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_OPTIONS.map((opt) => {
                  const isActive = statusFilter === opt.value;
                  const count =
                    opt.value === 'all'
                      ? subscriptions.length
                      : subscriptions.filter((s) => s.status === opt.value).length;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isActive
                          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                          : 'bg-white/5 text-zinc-400 border-[#252529] hover:border-[#10B981]/30 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-[#252529]">
              {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        )}

        {/* Subscriptions Table / Empty State */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden">
          {!hasData ? (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#10B981]/10 mb-4">
                <CreditCard className="w-7 h-7 text-[#10B981]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No subscriptions yet</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
                Create recurring plans and share recurring checkout links with your customers.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                + Create First Subscription Plan
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800/50 mb-4">
                <Calendar className="w-7 h-7 text-zinc-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No matches for this filter</h3>
              <p className="text-sm text-zinc-500">
                Try a different status filter to see more subscriptions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
              <table className="w-full min-w-[860px] text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-[#131316] z-10">
                  <tr className="text-zinc-400 border-b border-[#252529]/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Subscriber</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Plan</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Cycle</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Gateway</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252529]/30">
                  {filtered.map((sub, idx) => {
                    const statusCfg = STATUS_CONFIG[sub.status] || {
                      label: sub.status,
                      bg: 'bg-zinc-800',
                      text: 'text-zinc-400',
                      border: 'border-[#252529]',
                      icon: AlertTriangle,
                    };
                    const StatusIcon = statusCfg.icon;
                    const gatewayIcon = sub.gateway_slug ? GATEWAY_ICONS[sub.gateway_slug] : '🔌';
                    const initial = (sub.client_name || sub.client_email || '?').charAt(0).toUpperCase();
                    return (
                      <tr
                        key={sub.id}
                        className="hover:bg-white/5 transition-colors animate-stagger"
                        style={{ animationDelay: `${Math.min(idx, 8) * 0.04}s` }}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#10B981]/15 flex items-center justify-center text-[#10B981] font-bold text-xs shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="text-zinc-200 font-medium text-sm truncate max-w-[180px]">
                                {sub.client_name || 'Direct Customer'}
                              </p>
                              <p className="text-zinc-500 text-[10px] truncate max-w-[180px]">
                                {sub.client_email || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-zinc-200 font-medium text-sm">{sub.plan_name}</td>
                        <td className="py-3 text-right font-semibold text-white">{toUsd(sub.amount_cents)}</td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 text-zinc-400 text-xs capitalize">
                            <RefreshCw className="w-3 h-3 text-zinc-500" />
                            {sub.cycle}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1a1a1f] border border-[#252529] text-xs font-bold text-zinc-300">
                            <span>{gatewayIcon}</span>
                            {sub.gateway_label || sub.gateway_slug || 'Stripe'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => copyRecurringLink(sub)}
                              title="Copy Recurring Payment Link"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition cursor-pointer"
                            >
                              {copiedId === sub.id ? '✓ Copied' : '🔗 Link'}
                            </button>

                            {sub.status === 'active' ? (
                              <button
                                onClick={() => handleStatusChange(sub.id, 'paused')}
                                title="Pause subscription"
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs transition cursor-pointer"
                              >
                                Pause
                              </button>
                            ) : sub.status === 'paused' ? (
                              <button
                                onClick={() => handleStatusChange(sub.id, 'active')}
                                title="Resume subscription"
                                className="px-2 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs transition cursor-pointer"
                              >
                                Resume
                              </button>
                            ) : null}

                            {sub.status !== 'canceled' && (
                              <button
                                onClick={() => handleStatusChange(sub.id, 'canceled')}
                                title="Cancel subscription"
                                className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Create Recurring Plan */}
        {showModal && mounted && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowModal(false)} />
            <div className="relative z-10 w-full max-w-lg bg-[#111114] rounded-2xl shadow-2xl border border-[#2e2e34] overflow-hidden animate-slideUp my-4">
              <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">New Recurring Subscription Plan</h2>
                    <p className="text-white/80 text-xs mt-0.5">Automate recurring customer payments with custom timelines</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubscription} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                    Plan / Service Name *
                  </label>
                  <input
                    required
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Pro Retainer Plan or Premium Tier"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                      Recurring Amount (USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={amountUsd}
                        onChange={(e) => setAmountUsd(e.target.value)}
                        placeholder="49.00"
                        className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                      Billing Cycle / Timeline
                    </label>
                    <select
                      value={cycle}
                      onChange={(e) => setCycle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                    >
                      <option value="weekly">Weekly (Every 7 Days)</option>
                      <option value="biweekly">Bi-Weekly (Every 14 Days)</option>
                      <option value="monthly">Monthly (Every 30 Days)</option>
                      <option value="quarterly">Quarterly (Every 3 Months)</option>
                      <option value="semiannual">Semi-Annual (Every 6 Months)</option>
                      <option value="yearly">Yearly (Annual)</option>
                      <option value="custom">Custom Timeline (Set Interval)...</option>
                    </select>
                  </div>
                </div>

                {/* Custom Timeline Configuration */}
                {cycle === 'custom' && (
                  <div className="p-3.5 rounded-xl bg-[#151518] border border-emerald-500/30 space-y-3 animate-fadeIn">
                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Custom Billing Interval
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400">Charge every</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={customInterval}
                        onChange={(e) => setCustomInterval(e.target.value)}
                        className="w-20 px-3 py-1.5 rounded-lg border border-[#252529] bg-[#18181c] text-zinc-100 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                      Free Trial Period
                    </label>
                    <select
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                    >
                      <option value="0">No Free Trial (Charge Immediately)</option>
                      <option value="7">7-Day Free Trial</option>
                      <option value="14">14-Day Free Trial</option>
                      <option value="30">30-Day Free Trial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                      Subscriber Name (Optional)
                    </label>
                    <input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                    Subscriber Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#252529] text-zinc-400 text-sm font-semibold hover:bg-white/5 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !planName || !amountUsd}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
                  >
                    {submitting ? 'Creating Plan...' : 'Create Recurring Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </section>
  );
}
