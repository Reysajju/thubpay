'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Zap,
  Plus,
  RefreshCw,
  Shield,
  Timer,
  Route,
  Play,
  Pause,
  ChevronRight,
  Cpu,
  Clock,
  CheckCircle2,
  PauseCircle,
  Inbox,
} from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  gateway_slug: string | null;
  status: string;
  executions: number;
  last_run_at: string | null;
  created_at: string;
}

interface Props {
  workspaceId: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  active: { label: 'Active', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25', icon: CheckCircle2 },
  paused: { label: 'Paused', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25', icon: PauseCircle },
  draft: { label: 'Draft', bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/25', icon: Pause },
};

const GATEWAY_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  square: '⬜',
  adyen: '🔷',
  razorpay: '⚡',
  manual: '✋',
};

const TRIGGER_ICONS: Record<string, any> = {
  'payment_intent.failed': RefreshCw,
  'invoice.overdue': Timer,
  payment_declined: Route,
  'dispute.created': Shield,
  'subscription.canceled': PauseCircle,
};

const QUICK_TEMPLATES = [
  { icon: Route, label: 'Smart Routing', desc: 'Auto-fallback on declined payments' },
  { icon: RefreshCw, label: 'Dunning Sequences', desc: 'Multi-step overdue reminders' },
  { icon: Timer, label: 'Retry Logic', desc: 'Configurable retry schedules' },
  { icon: Shield, label: 'Revenue Recovery', desc: 'Win-back for lost disputes' },
];

export default function AutomationClient({ workspaceId }: Props) {
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [ruleName, setRuleName] = useState('');
  const [trigger, setTrigger] = useState('payment_intent.failed');
  const [action, setAction] = useState('Auto-retry transaction via backup gateway after 2 hours');
  const [gatewaySlug, setGatewaySlug] = useState('');

  const fetchRules = () => {
    fetch('/api/dashboard/automation/rules')
      .then((res) => res.json())
      .then((data) => {
        if (data.rules) setRules(data.rules);
      })
      .catch((err) => console.error('Failed to fetch automation rules:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRules();
  }, [workspaceId]);

  const stats = useMemo(() => {
    const list = rules || [];
    const active = list.filter((r) => (localStatus[r.id] || r.status) === 'active').length;
    const paused = list.filter((r) => (localStatus[r.id] || r.status) === 'paused').length;
    const totalExec = list.reduce((sum, r) => sum + (r.executions || 0), 0);
    return { total: list.length, active, paused, totalExecutions: totalExec };
  }, [rules, localStatus]);

  const toggleRule = async (ruleId: string, currentStatus: string) => {
    const next = currentStatus === 'active' ? 'paused' : 'active';
    setLocalStatus((prev) => ({ ...prev, [ruleId]: next }));

    try {
      await fetch('/api/dashboard/automation/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, status: next }),
      });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await fetch(`/api/dashboard/automation/rules?id=${ruleId}`, {
        method: 'DELETE',
      });
      setRules((prev) => (prev ? prev.filter((r) => r.id !== ruleId) : []));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !trigger || !action) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/dashboard/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          trigger,
          action,
          gateway_slug: gatewaySlug || undefined,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setRuleName('');
        setGatewaySlug('');
        fetchRules();
      }
    } catch (err) {
      console.error('Error creating rule:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setRuleName(tpl.label);
    if (tpl.label.includes('Routing')) {
      setTrigger('payment_declined');
      setAction('Auto-switch to secondary gateway (PayPal/Square) on decline');
    } else if (tpl.label.includes('Dunning')) {
      setTrigger('invoice.overdue');
      setAction('Send automated email reminder sequence at 3, 7, and 14 days');
    } else if (tpl.label.includes('Retry')) {
      setTrigger('payment_intent.failed');
      setAction('Exponential backoff retry: 4h, 24h, 72h');
    } else {
      setTrigger('dispute.created');
      setAction('Auto-generate proof of delivery & evidence package');
    }
    setShowModal(true);
  };

  if (loading || rules === null) {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#10B981]/10 mb-4">
                <Activity className="w-6 h-6 text-[#10B981] animate-pulse" />
              </div>
              <p className="text-zinc-400 text-sm">Loading automation rules...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const hasData = rules.length > 0;

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                <Zap className="w-3 h-3" />
                {stats.active} active
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
                <Cpu className="w-3 h-3" />
                {stats.totalExecutions} runs
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Automation &amp; Workflows
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              No-code rules for smart routing, dunning, and retries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 w-fit transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-1">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Total Rules
            </p>
            <p className="text-xl sm:text-2xl font-black text-white animate-count">
              {stats.total}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Configured workflows</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-2">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Play className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Active Rules
            </p>
            <p className="text-xl sm:text-2xl font-black text-green-400 animate-count">
              {stats.active}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Running workflows</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-3">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Pause className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Paused Rules
            </p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 animate-count">
              {stats.paused}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Suspended workflows</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Total Executions
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#10B981] animate-count">
              {stats.totalExecutions.toLocaleString()}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Lifetime runs</p>
          </div>
        </div>

        {/* Rules List / Empty State */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Automation Rules</h2>
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-[#252529]">
              {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
            </span>
          </div>

          {!hasData ? (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#10B981]/10 mb-4">
                <Inbox className="w-7 h-7 text-[#10B981]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No automation rules yet</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
                Create your first workflow to automate retries, dunning sequences,
                and gateway fallbacks. Pick a template below to get started.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                + Create First Workflow
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
              {rules.map((rule, idx) => {
                const status = localStatus[rule.id] || rule.status;
                const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
                const StatusIcon = statusCfg.icon;
                const TriggerIcon = TRIGGER_ICONS[rule.trigger] || Zap;
                const gatewayIcon = rule.gateway_slug ? GATEWAY_ICONS[rule.gateway_slug] : '🌐';
                const isActive = status === 'active';

                return (
                  <div
                    key={rule.id}
                    className="p-4 rounded-2xl bg-white/5 border border-[#252529] hover:border-[#10B981]/30 transition-all flex items-start gap-4 group animate-stagger"
                    style={{ animationDelay: `${Math.min(idx, 8) * 0.05}s` }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-[#10B981]/10' : 'bg-zinc-800/60'
                    }`}>
                      <TriggerIcon className={`w-5 h-5 ${isActive ? 'text-[#10B981]' : 'text-zinc-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-white text-sm truncate">{rule.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {statusCfg.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 mb-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-zinc-500 font-medium">Trigger:</span>
                          <code className="px-1.5 py-0.5 rounded bg-[#0a0a0c] border border-[#252529] text-[#10B981] font-mono text-[11px]">
                            {rule.trigger}
                          </code>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-zinc-500 font-medium">Action:</span>
                          <span className="text-zinc-300">{rule.action}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1a1a1f] border border-[#252529] text-zinc-300 font-semibold">
                          <span>{gatewayIcon}</span>
                          {rule.gateway_slug || 'All Gateways'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          <span className="text-zinc-300 font-medium">{rule.executions.toLocaleString()}</span> executions
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last: <span className="text-zinc-300 font-medium">{timeAgo(rule.last_run_at)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Toggle + Delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleRule(rule.id, status)}
                        aria-label={isActive ? 'Pause rule' : 'Activate rule'}
                        title={isActive ? 'Pause rule' : 'Activate rule'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20'
                            : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25 hover:bg-[#10B981]/20'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Pause className="w-3 h-3" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Activate
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteRule(rule.id)}
                        aria-label="Delete rule"
                        title="Delete rule"
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Setup Templates */}
        <div className="mt-6 glass-card rounded-3xl p-4 sm:p-6">
          <h2 className="text-lg font-bold text-white mb-4">Quick Setup Templates</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {QUICK_TEMPLATES.map((tpl, idx) => {
              const Icon = tpl.icon;
              return (
                <div
                  key={tpl.label}
                  onClick={() => openTemplate(tpl)}
                  className="p-4 rounded-xl bg-white/5 border border-[#252529] text-center hover:border-[#10B981]/50 hover:bg-[#10B981]/10 transition-all cursor-pointer animate-stagger group"
                  style={{ animationDelay: `${0.05 + idx * 0.05}s` }}
                >
                  <Icon className="w-6 h-6 text-[#10B981] mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-white mb-1">{tpl.label}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{tpl.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal: Create Automation Rule */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative z-10 w-full max-w-lg bg-[#111114] rounded-2xl shadow-2xl border border-[#252529] overflow-hidden animate-slideUp">
              <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">New Automation Workflow</h2>
                    <p className="text-white/80 text-xs mt-0.5">Automate smart retry, dunning, or routing</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                    Rule Name *
                  </label>
                  <input
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Smart Backup Gateway on Card Decline"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                      When Event Occurs (Trigger)
                    </label>
                    <select
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                    >
                      <option value="payment_intent.failed">Payment Failed / Declined</option>
                      <option value="invoice.overdue">Invoice Overdue</option>
                      <option value="payment_declined">Routing Error</option>
                      <option value="dispute.created">Dispute / Chargeback Filed</option>
                      <option value="subscription.canceled">Subscription Canceled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                      Target Gateway
                    </label>
                    <select
                      value={gatewaySlug}
                      onChange={(e) => setGatewaySlug(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                    >
                      <option value="">All Connected Gateways</option>
                      <option value="stripe">Stripe</option>
                      <option value="paypal">PayPal</option>
                      <option value="square">Square</option>
                      <option value="razorpay">Razorpay</option>
                      <option value="adyen">Adyen</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                    Action to Execute *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="e.g. Automatically retry on PayPal and notify the client via email"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition resize-none"
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
                    disabled={submitting || !ruleName || !action}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
                  >
                    {submitting ? 'Creating...' : 'Save & Activate Workflow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
