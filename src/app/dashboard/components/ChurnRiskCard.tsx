'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Mail, TrendingDown } from 'lucide-react';
import type { ChurnRiskScore } from '@/lib/demo-data';

interface ChurnRiskSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  averageRiskScore: number;
  potentialRevenueAtRiskCents: number;
}

interface Props {
  atRisk: ChurnRiskScore[];
  summary: ChurnRiskSummary;
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format((cents || 0) / 100);
}

function getInitial(name: string): string {
  return (name || '?').trim()[0]?.toUpperCase() || '?';
}

// Per-tier visual palette. Each entry controls the color of the score
// number, the surrounding badge/ring on the avatar, and the bar tint.
const TIER_STYLES: Record<
  ChurnRiskScore['riskTier'],
  { score: string; badge: string; ring: string; label: string }
> = {
  critical: {
    score: 'text-red-400',
    badge: 'border-red-500/30 bg-red-500/5',
    ring: 'ring-red-500/40',
    label: 'Critical',
  },
  high: {
    score: 'text-amber-400',
    badge: 'border-amber-500/30 bg-amber-500/5',
    ring: 'ring-amber-500/40',
    label: 'High',
  },
  medium: {
    score: 'text-yellow-400',
    badge: 'border-yellow-500/30 bg-yellow-500/5',
    ring: 'ring-yellow-500/40',
    label: 'Medium',
  },
  low: {
    score: 'text-emerald-400',
    badge: 'border-emerald-500/30 bg-emerald-500/5',
    ring: 'ring-emerald-500/40',
    label: 'Low',
  },
};

export default function ChurnRiskCard({ atRisk, summary }: Props) {
  // Color the average-risk badge by tier thresholds (mirrors riskTier math
  // in getChurnRiskScores so the badge stays in sync with the score).
  const avgBadgeColor =
    summary.averageRiskScore >= 80
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : summary.averageRiskScore >= 60
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : summary.averageRiskScore >= 40
          ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

  return (
    <section className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn hover-lift gradient-border-glow">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white leading-none">Churn Risk</h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              {summary.total} {summary.total === 1 ? 'client' : 'clients'} scored
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${avgBadgeColor}`}
          title="Average churn-risk score across all clients (0-100, higher = riskier)"
        >
          <AlertTriangle className="w-3 h-3" />
          Avg {summary.averageRiskScore}
        </span>
      </div>

      {/* Summary ribbon */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-black/20 border border-[#252529]/60">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            Critical
          </p>
          <p className="text-xl sm:text-2xl font-black text-red-400 tabular-nums">
            {summary.critical}
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529]" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            High Risk
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums">
            {summary.high}
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529]" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            Revenue at Risk
          </p>
          <p className="text-xl sm:text-2xl font-black text-white tabular-nums">
            {toUsd(summary.potentialRevenueAtRiskCents)}
          </p>
        </div>
      </div>

      {/* At-risk list */}
      {atRisk.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10 skeleton-pulse">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
            <AlertTriangle className="w-5 h-5 text-emerald-400/50" />
          </span>
          <p className="text-sm font-semibold text-zinc-300">No at-risk customers</p>
          <p className="text-xs text-zinc-600 mt-1">
            Your churn indicators look healthy.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {atRisk.map((c, i) => {
            const style = TIER_STYLES[c.riskTier];
            return (
              <li
                key={c.clientId}
                className={`relative rounded-2xl border ${style.badge} bg-black/10 p-3 animate-stagger stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <span
                    className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700/40 to-zinc-900/20 text-white font-bold text-sm ring-2 ${style.ring} flex-shrink-0`}
                  >
                    {getInitial(c.name)}
                  </span>

                  {/* Name + email + risk factors */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">
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
                    {c.riskFactors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.riskFactors.map((f, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-amber-500/10 text-amber-300/80 border border-amber-500/20"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Risk score */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-black tabular-nums ${style.score}`}>
                      {c.riskScore}
                    </p>
                    <p className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                      {style.label}
                    </p>
                  </div>
                </div>

                {/* Recommended action + email link */}
                <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 min-w-0 truncate">
                    <TrendingDown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="truncate">{c.recommendedAction}</span>
                  </p>
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="link-underline text-[10px] font-semibold text-[#10B981] hover:text-[#34D399] transition-colors flex-shrink-0"
                    >
                      Email →
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-[#252529]/60 flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="truncate hidden sm:inline">
            Heuristic score · Recency 40% · Frequency 25% · Trend 20% · Cadence 15%
          </span>
          <span className="truncate sm:hidden">Heuristic score</span>
        </p>
        <Link
          href="/dashboard/customers"
          className="link-underline text-[11px] font-semibold text-[#10B981] hover:text-[#34D399] transition-colors flex items-center gap-1 group flex-shrink-0"
        >
          Manage customers
          <ArrowUpRight className="w-3 h-3 icon-bounce group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
