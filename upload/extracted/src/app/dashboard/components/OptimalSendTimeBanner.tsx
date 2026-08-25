'use client';

import { useMemo } from 'react';
import { Sparkles, Clock, Calendar, TrendingUp, ArrowRight, X } from 'lucide-react';

interface Props {
  totalViews: number;
  peakDay: number | null;
  peakHour: number | null;
  peakCell: { day: number; hour: number; count: number } | null;
  // 7×24 grid of view counts (from getInvoiceOpenHeatmap)
  cells: { day: number; hour: number; count: number }[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

/**
 * Smart suggestion banner that analyzes the invoice open heatmap and
 * recommends the best day + hour to send invoices for maximum open rate.
 *
 * Logic:
 *   - If we have < 10 total views, show a "collecting data" state.
 *   - Otherwise, find the day+hour cell with the highest view count.
 *   - Recommend sending invoices ~1 hour BEFORE the peak open time
 *     (so the invoice is fresh in the client's inbox when they're
 *     most likely to check it).
 *   - Show the recommendation with a dismiss button (uses localStorage).
 */
export default function OptimalSendTimeBanner({
  totalViews,
  peakDay,
  peakHour,
  peakCell,
  cells,
}: Props) {
  const dismissed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('thubpay:optimal-send-dismissed') === '1';
  }, []);

  const recommendation = useMemo(() => {
    if (!peakCell || !peakDay || !peakHour) return null;

    // Recommend sending 1 hour before the peak open time.
    // If peak is at 12 AM (0), recommend 11 PM (23) the day before.
    let sendHour = peakHour - 1;
    let sendDay = peakDay;
    if (sendHour < 0) {
      sendHour = 23;
      sendDay = (peakDay - 1 + 7) % 7;
    }

    // Find the second-best cell to compare against (for the lift %).
    const sorted = [...cells].sort((a, b) => b.count - a.count);
    const peakCount = sorted[0]?.count ?? 0;
    const avgCount = totalViews > 0 ? totalViews / 168 : 0; // 7×24 = 168 cells
    const liftPct = avgCount > 0 ? Math.round(((peakCount - avgCount) / avgCount) * 100) : 0;

    return {
      sendDay,
      sendHour,
      peakDay,
      peakHour,
      peakCount,
      avgCount: Math.round(avgCount * 10) / 10,
      liftPct,
    };
  }, [peakCell, peakDay, peakHour, cells, totalViews]);

  if (dismissed) return null;

  // Collecting data state — need at least 10 views for a meaningful recommendation
  if (totalViews < 10) {
    return (
      <div className="glass-card rounded-3xl p-4 sm:p-5 mb-6 animate-fadeIn border border-blue-500/20 bg-blue-500/[0.02]">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-300">
              Collecting data for send-time optimization
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              We need at least 10 invoice views to make a smart recommendation. You currently have{' '}
              <span className="font-bold text-zinc-200 tabular-nums">{totalViews}</span> — keep sending invoices!
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 max-w-[200px] h-1.5 rounded-full bg-[#1a1a1f] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  style={{ width: `${Math.min(100, (totalViews / 10) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-blue-400 tabular-nums">
                {totalViews}/10
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendation) return null;

  const { sendDay, sendHour, peakDay: pd, peakHour: ph, peakCount, liftPct } = recommendation;
  const isHighConfidence = peakCount >= 3;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5 mb-6 animate-fadeIn border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start gap-3 relative">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#34D399] flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Sparkles className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-emerald-300">
              Smart send-time recommendation
            </p>
            {isHighConfidence ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                HIGH CONFIDENCE
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                EMERGING PATTERN
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Based on <span className="font-bold text-white tabular-nums">{totalViews}</span> tracked invoice views,
            your clients are most active on{' '}
            <span className="font-bold text-emerald-300">{DAYS[pd]}</span> around{' '}
            <span className="font-bold text-emerald-300">{hourLabel(ph)}</span>{' '}
            ({peakCount} view{peakCount === 1 ? '' : 's'} — {liftPct}% above average).
          </p>
          <div className="mt-3 p-3 rounded-xl bg-[#0a0a0c]/60 border border-emerald-500/20 flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Recommended send time
              </p>
              <p className="text-sm font-bold text-white">
                {DAYS[sendDay]} at {hourLabel(sendHour)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                ~1 hour before your peak open time, so the invoice is fresh in the client&apos;s inbox
              </p>
            </div>
            <div className="flex-shrink-0 hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-300">
                +{liftPct}% opens
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              Peak day: <span className="text-zinc-300 font-semibold">{DAYS_SHORT[pd]}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Peak hour: <span className="text-zinc-300 font-semibold">{hourLabel(ph)}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              Avg/hour: <span className="text-zinc-400 font-mono tabular-nums">{recommendation.avgCount}</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('thubpay:optimal-send-dismissed', '1');
            // Force re-render by reloading — simple and reliable
            window.location.reload();
          }}
          className="flex-shrink-0 p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition"
          title="Dismiss suggestion"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
