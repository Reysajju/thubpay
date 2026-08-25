'use client';

import { useState, useMemo } from 'react';
import {
  UserPlus,
  Users,
  TrendingUp,
  DollarSign,
  Repeat,
  Search,
  X,
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  ChevronRight,
  ExternalLink,
  CreditCard,
  Clock,
  Activity,
} from 'lucide-react';
import AddClientModal from '../components/AddClientModal';

interface Invoice {
  id: string;
  invoice_number: string | null;
  status: string;
  total_cents: number;
  currency: string;
  due_date: string | null;
  paid_via_gateway: string | null;
  custom_payment_gateway: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  total_spend_cents: number;
  transaction_count: number;
  last_payment_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  newThisMonth: number;
  repeatClients: number;
  totalSpend: number;
}

interface Props {
  clients: Client[];
  stats: Stats;
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

// Generate a deterministic gradient from a string
function getAvatarGradient(seed: string): string {
  const gradients = [
    'from-amber-500/20 to-orange-600/20 text-amber-400',
    'from-emerald-500/20 to-teal-600/20 text-emerald-400',
    'from-cyan-500/20 to-teal-600/20 text-cyan-400',
    'from-purple-500/20 to-pink-600/20 text-purple-400',
    'from-rose-500/20 to-red-600/20 text-rose-400',
    'from-cyan-500/20 to-sky-600/20 text-cyan-400',
    'from-yellow-500/20 to-amber-600/20 text-yellow-400',
    'from-green-500/20 to-emerald-600/20 text-green-400',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400 border-green-500/25',
  sent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  viewed: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/25',
  draft: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  void: 'bg-zinc-800 text-zinc-400 border-[#252529]',
};

// ── Customer Lifecycle Stage ────────────────────────────────
type LifecycleStage = 'new' | 'active' | 'at_risk' | 'churned' | 'lead';

interface StageConfig {
  label: string;
  chip: string;
  dot: string;
  filterValue: LifecycleStage | 'all';
}

const STAGE_CONFIG: Record<LifecycleStage, StageConfig> = {
  new: {
    label: 'New',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
    filterValue: 'new',
  },
  active: {
    label: 'Active',
    chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
    dot: 'bg-cyan-400',
    filterValue: 'active',
  },
  at_risk: {
    label: 'At Risk',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400',
    filterValue: 'at_risk',
  },
  churned: {
    label: 'Churned',
    chip: 'bg-red-500/10 text-red-300 border-red-500/25',
    dot: 'bg-red-400',
    filterValue: 'churned',
  },
  lead: {
    label: 'Lead',
    chip: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25',
    dot: 'bg-zinc-400',
    filterValue: 'lead',
  },
};

const STAGE_ORDER: LifecycleStage[] = ['new', 'active', 'at_risk', 'churned', 'lead'];

function computeStage(client: Client): LifecycleStage {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const txCount = client.transaction_count || 0;

  // Lead: never paid (no transactions) and was created within the last 14 days
  if (txCount === 0) {
    const createdAt = new Date(client.created_at).getTime();
    if (now - createdAt < 14 * DAY) return 'lead';
    return 'lead';
  }

  // No recorded last payment — fall back to creation date if there are transactions
  const lastPayIso = client.last_payment_at;
  const lastPayMs = lastPayIso ? new Date(lastPayIso).getTime() : new Date(client.created_at).getTime();
  const daysSincePayment = Math.floor((now - lastPayMs) / DAY);

  if (daysSincePayment < 7 && txCount >= 1) return 'new';
  if (daysSincePayment < 30) return 'active';
  if (daysSincePayment < 60) return 'at_risk';
  return 'churned';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
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

export default function ClientsTableClient({ clients, stats }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'spend' | 'name' | 'recent'>('spend');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientInvoices, setClientInvoices] = useState<Invoice[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stageFilter, setStageFilter] = useState<LifecycleStage | 'all'>('all');

  const maxSpend = useMemo(
    () => Math.max(...clients.map((c) => c.total_spend_cents || 0), 1),
    [clients]
  );

  const filtered = useMemo(() => {
    let result = search
      ? clients.filter(
          (c) =>
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.company?.toLowerCase().includes(search.toLowerCase())
        )
      : [...clients];

    // Stage filter
    if (stageFilter !== 'all') {
      result = result.filter((c) => computeStage(c) === stageFilter);
    }

    if (sortBy === 'spend') {
      result.sort((a, b) => b.total_spend_cents - a.total_spend_cents);
    } else if (sortBy === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  }, [clients, search, sortBy, stageFilter]);

  // Per-stage counts for the filter pills
  const stageCounts = useMemo(() => {
    const counts: Record<LifecycleStage, number> = {
      new: 0, active: 0, at_risk: 0, churned: 0, lead: 0,
    };
    for (const c of clients) {
      counts[computeStage(c)]++;
    }
    return counts;
  }, [clients]);

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client);
    setClientInvoices(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/dashboard/clients/${client.id}`);
      if (res.ok) {
        const data = await res.json();
        setClientInvoices(data.invoices || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedClient(null);
    setClientInvoices(null);
  };

  const avgSpend = stats.total > 0 ? Math.round(stats.totalSpend / stats.total) : 0;

  return (
    <>
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  <Users className="w-3 h-3" />
                  {stats.total} customers
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Customers
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Unified CRM profiles across all payment gateways.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl text-[#111] text-sm font-bold shadow-lg shadow-[#10B981]/20 w-fit"
            >
              <UserPlus className="w-4 h-4" />
              Add Client
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Total Clients
                </span>
              </div>
              <p className="text-xl font-black text-white animate-count">{stats.total}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{stats.newThisMonth} new this month</p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-green-400" />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Lifetime Revenue
                </span>
              </div>
              <p className="text-xl font-black text-white animate-count">{toUsd(stats.totalSpend)}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{toUsd(avgSpend)} avg / client</p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Repeat className="w-3.5 h-3.5 text-[#10B981]" />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Repeat Clients
                </span>
              </div>
              <p className="text-xl font-black text-[#10B981] animate-count">{stats.repeatClients}</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {stats.total > 0 ? Math.round((stats.repeatClients / stats.total) * 100) : 0}% retention
              </p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-4 animate-stagger stagger-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  New This Month
                </span>
              </div>
              <p className="text-xl font-black text-green-400 animate-count">{stats.newThisMonth}</p>
              <p className="text-[11px] text-zinc-500 mt-1">recent acquisitions</p>
            </div>
          </div>

          {/* Search + Sort */}
          <div className="glass-card rounded-2xl p-4 mb-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer appearance-none"
                >
                  <option value="spend">Highest Spend</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="recent">Most Recent</option>
                </select>
              </div>
            </div>
            {search && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#252529]/50">
                <span className="text-[11px] text-zinc-500">
                  Showing {filtered.length} of {clients.length} clients
                </span>
                <button
                  onClick={() => setSearch('')}
                  className="flex items-center gap-1 text-[11px] text-[#10B981] hover:text-[#34D399] transition-colors ml-auto"
                >
                  <X className="w-3 h-3" />
                  Clear search
                </button>
              </div>
            )}
          </div>

          {/* Stage Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-6 animate-fadeIn">
            <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mr-1 hidden sm:inline">
              Lifecycle:
            </span>
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                stageFilter === 'all'
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-transparent text-zinc-400 border-[#252529] hover:text-zinc-200 hover:border-[#3a3a3f]'
              }`}
            >
              All
              <span className="text-[10px] text-zinc-500 font-bold">
                {clients.length}
              </span>
            </button>
            {STAGE_ORDER.map((stage) => {
              const cfg = STAGE_CONFIG[stage];
              const count = stageCounts[stage] || 0;
              const isActive = stageFilter === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(isActive ? 'all' : stage)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    isActive
                      ? `${cfg.chip} scale-105`
                      : 'bg-transparent text-zinc-400 border-[#252529] hover:text-zinc-200 hover:border-[#3a3a3f]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                  <span className={`text-[10px] font-bold ${isActive ? '' : 'text-zinc-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {stageFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className="flex items-center gap-1 text-[11px] text-[#10B981] hover:text-[#34D399] transition-colors ml-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Clients Grid */}
          {filtered.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center animate-fadeIn">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-zinc-800/50 mb-3">
                <Users className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">
                {clients.length === 0 ? 'No clients yet' : 'No clients match your search'}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {clients.length === 0
                  ? 'Click "Add Client" to create your first customer profile'
                  : 'Try a different search term'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((client, i) => {
                const gradient = getAvatarGradient(client.name || client.id);
                const initials = (client.name || client.email || 'U')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const spendPct = Math.round((client.total_spend_cents / maxSpend) * 100);
                const isRepeat = client.transaction_count > 1;
                const stage = computeStage(client);
                const stageCfg = STAGE_CONFIG[stage];
                const lastPayDisplay = client.last_payment_at
                  ? timeAgo(client.last_payment_at)
                  : null;

                return (
                  <div
                    key={client.id}
                    onClick={() => openClientDetail(client)}
                    className={`glass-card glass-card-hover rounded-2xl p-5 cursor-pointer animate-stagger stagger-${Math.min(i + 1, 6)} group relative overflow-hidden`}
                  >
                    {/* Decorative gradient stripe on the left edge colored by stage */}
                    <span
                      className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 ${stageCfg.dot}`}
                      aria-hidden
                    />
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-sm`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">
                            {client.name || 'Unnamed'}
                          </p>
                          {client.company && (
                            <p className="text-zinc-500 text-[11px] truncate flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              {client.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${stageCfg.chip}`}
                          title={`Lifecycle stage: ${stageCfg.label}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageCfg.dot}`} />
                          {stageCfg.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#10B981] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Email */}
                    {client.email && (
                      <p className="text-zinc-500 text-[11px] mb-3 truncate flex items-center gap-1.5">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {client.email}
                      </p>
                    )}

                    {/* Spend bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          Total Spend
                        </span>
                        <span className="text-sm font-bold text-white">
                          {toUsd(client.total_spend_cents)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1a1a1f] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#10B981]/60 to-[#34D399] transition-all duration-500"
                          style={{ width: `${Math.max(spendPct, 2)}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer stats */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#252529]/40">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <FileText className="w-3 h-3" />
                          {client.transaction_count} {client.transaction_count === 1 ? 'invoice' : 'invoices'}
                        </span>
                        {isRepeat && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                            <Repeat className="w-2.5 h-2.5" />
                            Repeat
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[10px] text-zinc-600 flex items-center gap-1"
                        title={client.last_payment_at ? `Last payment on ${new Date(client.last_payment_at).toLocaleDateString()}` : 'No payments yet'}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {lastPayDisplay ? `paid ${lastPayDisplay}` : `added ${timeAgo(client.created_at)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Customer Detail Drawer */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={closeDetail}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
          <div
            className="relative w-full max-w-md bg-[#0d0d0e] border-l border-[#252529] h-full overflow-y-auto custom-scrollbar animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0d0d0e]/95 backdrop-blur-xl border-b border-[#252529] px-6 py-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Customer Details</h2>
              <button
                onClick={closeDetail}
                className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Profile section */}
            <div className="px-6 py-6 border-b border-[#252529]/50">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getAvatarGradient(selectedClient.name || selectedClient.id)} flex items-center justify-center font-bold text-xl`}
                >
                  {(selectedClient.name || selectedClient.email || 'U')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-white truncate">{selectedClient.name}</h3>
                  {selectedClient.company && (
                    <p className="text-sm text-zinc-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {selectedClient.company}
                    </p>
                  )}
                  <div className="mt-1.5">
                    {(() => {
                      const stage = computeStage(selectedClient);
                      const cfg = STAGE_CONFIG[stage];
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.chip}`}
                          title={`Lifecycle stage: ${cfg.label}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                {selectedClient.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">{selectedClient.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span className="text-zinc-400">Customer since {timeAgo(selectedClient.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="px-6 py-5 border-b border-[#252529]/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#131316] border border-[#252529]/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Total Spend
                  </p>
                  <p className="text-lg font-black text-white">
                    {toUsd(selectedClient.total_spend_cents)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#131316] border border-[#252529]/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Invoices
                  </p>
                  <p className="text-lg font-black text-[#10B981]">
                    {selectedClient.transaction_count}
                  </p>
                </div>
              </div>
            </div>

            {/* Lifecycle Insights */}
            <div className="px-6 py-5 border-b border-[#252529]/50">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Lifecycle Insights
              </h4>

              {(() => {
                const stage = computeStage(selectedClient);
                const cfg = STAGE_CONFIG[stage];

                // Compute days-since-payment
                const DAY = 24 * 60 * 60 * 1000;
                const lastPayMs = selectedClient.last_payment_at
                  ? new Date(selectedClient.last_payment_at).getTime()
                  : null;
                const daysSince = lastPayMs
                  ? Math.max(0, Math.floor((Date.now() - lastPayMs) / DAY))
                  : null;

                // Compute 6-month sparkline buckets of paid invoices
                const now = new Date();
                const buckets: { label: string; count: number }[] = [];
                for (let i = 5; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const label = d.toLocaleDateString('en-US', { month: 'short' });
                  const monthStart = d.getTime();
                  const monthEnd = new Date(
                    d.getFullYear(),
                    d.getMonth() + 1,
                    1
                  ).getTime();
                  const count = (clientInvoices || []).filter(
                    (inv) =>
                      inv.status === 'paid' &&
                      new Date(inv.created_at).getTime() >= monthStart &&
                      new Date(inv.created_at).getTime() < monthEnd
                  ).length;
                  buckets.push({ label, count });
                }
                const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

                // Stage-specific suggested action
                const stageAction: Record<LifecycleStage, { text: string; cta: string; href: string }> = {
                  new: {
                    text: 'New customer — send a welcome email to encourage repeat business.',
                    cta: 'Send welcome email',
                    href: `mailto:${selectedClient.email ?? ''}?subject=Welcome%20to%20${encodeURIComponent(selectedClient.company || 'our service')}`,
                  },
                  active: {
                    text: 'Engaged customer — consider offering a loyalty discount or upsell.',
                    cta: 'Create invoice',
                    href: '/dashboard',
                  },
                  at_risk: {
                    text: 'Activity slowing down — send a re-engagement email or promotion.',
                    cta: 'Re-engage customer',
                    href: `mailto:${selectedClient.email ?? ''}?subject=We%20miss%20you!`,
                  },
                  churned: {
                    text: 'This customer has been inactive for over 60 days. Send a win-back campaign.',
                    cta: 'Win back customer',
                    href: `mailto:${selectedClient.email ?? ''}?subject=Let%27s%20reconnect`,
                  },
                  lead: {
                    text: 'Lead with no transactions yet — send your first invoice to convert them.',
                    cta: 'Create first invoice',
                    href: '/dashboard',
                  },
                };
                const action = stageAction[stage];

                return (
                  <div className="space-y-4">
                    {/* Stage + suggested action */}
                    <div className={`p-3 rounded-xl border ${cfg.chip}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {cfg.label}
                        </span>
                        {daysSince !== null && (
                          <span className="text-[10px] text-zinc-500 ml-auto">
                            {daysSince === 0 ? 'last paid today' : `last paid ${daysSince}d ago`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed mb-2.5">
                        {action.text}
                      </p>
                      {selectedClient.email && (
                        <a
                          href={action.href}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-200 transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                          {action.cta}
                          <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* 6-month payment sparkline */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          Paid Invoices · Last 6 Months
                        </span>
                        <span className="text-[10px] text-zinc-500 tabular-nums">
                          {buckets.reduce((s, b) => s + b.count, 0)} total
                        </span>
                      </div>
                      {loadingDetail ? (
                        <div className="flex items-end justify-between gap-1.5 h-12">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex-1 h-full rounded bg-[#1a1a1f] animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-end justify-between gap-1.5 h-12">
                          {buckets.map((b, i) => {
                            const heightPct = (b.count / maxBucket) * 100;
                            const isCurrent = i === buckets.length - 1;
                            return (
                              <div
                                key={b.label}
                                className="flex-1 flex flex-col items-center gap-1 group"
                              >
                                <div
                                  className={`w-full rounded-t-sm transition-all duration-300 ${
                                    isCurrent
                                      ? 'bg-gradient-to-t from-[#10B981]/60 to-[#34D399]'
                                      : 'bg-[#10B981]/30 group-hover:bg-[#10B981]/50'
                                  }`}
                                  style={{ height: `${Math.max(heightPct, b.count > 0 ? 12 : 4)}%` }}
                                  title={`${b.count} paid in ${b.label}`}
                                />
                                <span className="text-[9px] text-zinc-600">{b.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Invoice history */}
            <div className="px-6 py-5">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Invoice History
              </h4>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#10B981]/30 border-t-[#10B981] rounded-full animate-spin" />
                </div>
              ) : clientInvoices && clientInvoices.length > 0 ? (
                <div className="space-y-2">
                  {clientInvoices.map((inv) => (
                    <a
                      key={inv.id}
                      href={`/invoice/${inv.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#131316] border border-[#252529]/50 hover:border-[#10B981]/30 transition-all group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[#10B981] truncate">
                          {inv.invoice_number || inv.id.slice(0, 12)}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            STATUS_STYLES[inv.status] || STATUS_STYLES.draft
                          }`}
                        >
                          {inv.status}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {toUsd(inv.total_cents)}
                        </span>
                        <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-[#10B981] transition-colors" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No invoices yet</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Create an invoice for this client from the dashboard
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AddClientModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </>
  );
}
