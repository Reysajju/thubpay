import Link from 'next/link';
import { Crown, ArrowUpRight, TrendingUp, Mail } from 'lucide-react';

export interface TopCustomer {
  name: string;
  email: string;
  company: string;
  totalSpend: number;
  transactionCount: number;
}

interface Props {
  customers: TopCustomer[];
  totalRevenue: number;
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format((cents || 0) / 100);
}

function toUsdFull(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function getInitial(name: string): string {
  return (name || '?').trim()[0]?.toUpperCase() || '?';
}

const RANK_STYLES = [
  {
    bg: 'from-amber-400/15 to-amber-600/5 border-amber-400/30',
    badge: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950',
    ring: 'ring-amber-400/40',
    icon: 'text-amber-300',
  },
  {
    bg: 'from-zinc-300/10 to-zinc-500/5 border-zinc-300/25',
    badge: 'bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900',
    ring: 'ring-zinc-300/40',
    icon: 'text-zinc-200',
  },
  {
    bg: 'from-orange-400/10 to-orange-700/5 border-orange-400/25',
    badge: 'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950',
    ring: 'ring-orange-400/40',
    icon: 'text-orange-300',
  },
];

const DEFAULT_STYLE = {
  bg: 'from-zinc-700/15 to-zinc-900/5 border-zinc-700/30',
  badge: 'bg-zinc-800 text-zinc-300',
  ring: 'ring-zinc-700/30',
  icon: 'text-zinc-400',
};

export default function TopCustomersCard({ customers, totalRevenue }: Props) {
  const top = customers.slice(0, 5);
  const maxSpend = top.length > 0 ? Math.max(...top.map((c) => c.totalSpend)) : 0;
  const totalShown = top.reduce((sum, c) => sum + c.totalSpend, 0);
  const revenueShare = totalRevenue > 0 ? Math.round((totalShown / totalRevenue) * 100) : 0;

  return (
    <section className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn hover-lift">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30">
            <Crown className="w-4 h-4 text-amber-300" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white leading-none">Top Customers</h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              {top.length} customers · {revenueShare}% of total revenue
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/customers"
          className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors group"
        >
          View all
          <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      {/* Summary ribbon */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-black/20 border border-[#252529]/60">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            Combined Revenue
          </p>
          <p className="text-xl sm:text-2xl font-black text-white tabular-nums">
            {toUsdFull(totalShown)}
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529]" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            Transactions
          </p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
            {top.reduce((sum, c) => sum + (c.transactionCount || 0), 0)}
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529]" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            Avg / Customer
          </p>
          <p className="text-xl sm:text-2xl font-black text-cyan-400 tabular-nums">
            {toUsd(top.length > 0 ? totalShown / top.length : 0)}
          </p>
        </div>
      </div>

      {/* Customer leaderboard */}
      {top.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/20 mb-3">
            <Crown className="w-5 h-5 text-[#10B981]/50" />
          </span>
          <p className="text-sm font-semibold text-zinc-300">No customers yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Once you start adding clients, your top revenue drivers will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {top.map((c, i) => {
            const rank = i + 1;
            const style = RANK_STYLES[i] || DEFAULT_STYLE;
            const pct = maxSpend > 0 ? Math.max(4, Math.round((c.totalSpend / maxSpend) * 100)) : 0;
            const revenuePct = totalRevenue > 0 ? ((c.totalSpend / totalRevenue) * 100) : 0;
            return (
              <li
                key={`${c.email}-${i}`}
                className={`relative rounded-2xl border bg-gradient-to-r ${style.bg} p-3 animate-stagger stagger-${Math.min(i + 1, 6)}`}
              >
                {/* Rank badge */}
                <span
                  className={`absolute -top-2 -left-2 z-10 flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-black shadow-lg ring-2 ring-black/40 ${style.badge}`}
                  aria-hidden
                >
                  {rank}
                </span>

                <Link
                  href="/dashboard/customers"
                  className="block group"
                  aria-label={`View ${c.name} details`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <span
                      className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#10B981]/30 to-[#06B6D4]/15 text-white font-bold text-sm ring-2 ${style.ring} flex-shrink-0`}
                    >
                      {getInitial(c.name)}
                    </span>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-[#34D399] transition-colors">
                          {c.name}
                        </p>
                        {c.company && (
                          <span className="hidden sm:inline-block text-[10px] text-zinc-500 truncate">
                            · {c.company}
                          </span>
                        )}
                      </div>
                      {c.email && (
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1 truncate">
                          <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white tabular-nums">
                        {toUsdFull(c.totalSpend)}
                      </p>
                      <p className="text-[10px] text-zinc-500 tabular-nums">
                        {c.transactionCount} {c.transactionCount === 1 ? 'tx' : 'txs'}
                      </p>
                    </div>
                  </div>

                  {/* Mini bar visualization */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-zinc-400 tabular-nums w-12 text-right">
                      {revenuePct.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-[#252529]/60 flex items-center justify-between">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          Top {top.length} customers drive{' '}
          <span className="font-bold text-emerald-400">{revenueShare}%</span> of revenue
        </p>
        <Link
          href="/dashboard/customers"
          className="link-underline text-[11px] font-semibold text-[#10B981] hover:text-[#34D399] transition-colors"
        >
          Manage customers
        </Link>
      </div>
    </section>
  );
}
