'use client';

import { useMemo, useState } from 'react';
import { Calendar, Clock, TrendingUp, Zap } from 'lucide-react';

interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
}

interface Props {
  cells: HeatmapCell[];
  totalViews: number;
  peakDay: number | null;
  peakHour: number | null;
  peakCell: { day: number; hour: number; count: number } | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

function dayLabel(d: number | null): string | null {
  if (d === null) return null;
  return DAYS[d] ?? null;
}

export default function InvoiceHeatmap({ cells, totalViews, peakDay, peakHour, peakCell }: Props) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  // Build a 7×24 lookup grid for quick access
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const c of cells) g[c.day][c.hour] = c.count;
    return g;
  }, [cells]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const row of grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [grid]);

  // Day totals (for the right column)
  const dayTotals = useMemo(() => grid.map((row) => row.reduce((s, n) => s + n, 0)), [grid]);
  // Hour totals (for the bottom row)
  const hourTotals = useMemo(() => {
    const arr = new Array(24).fill(0);
    for (let h = 0; h < 24; h++) for (let d = 0; d < 7; d++) arr[h] += grid[d][h];
    return arr;
  }, [grid]);

  if (totalViews === 0) {
    return (
      <div className="glass-card rounded-3xl p-6 animate-fadeIn">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-none">Invoice Open Heatmap</h3>
            <p className="text-xs text-zinc-500 mt-1">When clients are most likely to view your invoices</p>
          </div>
        </div>
        <div className="py-12 text-center text-zinc-500 text-sm">
          <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p>No invoice views tracked yet.</p>
          <p className="text-xs mt-1">Heatmap will appear once clients start opening your invoices.</p>
        </div>
      </div>
    );
  }

  // Pick which hours to label (every 3 hours to avoid clutter)
  const labelHours = [0, 3, 6, 9, 12, 15, 18, 21];

  function cellColor(count: number): string {
    if (count === 0) return 'bg-[#1a1a1f] border-[#252529]/30';
    const ratio = maxCount > 0 ? count / maxCount : 0;
    if (ratio >= 0.8) return 'bg-emerald-500/90 border-emerald-400';
    if (ratio >= 0.6) return 'bg-emerald-500/70 border-emerald-400/70';
    if (ratio >= 0.4) return 'bg-emerald-500/50 border-emerald-400/50';
    if (ratio >= 0.2) return 'bg-emerald-500/30 border-emerald-400/30';
    return 'bg-emerald-500/15 border-emerald-400/20';
  }

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-none">Invoice Open Heatmap</h3>
            <p className="text-xs text-zinc-500 mt-1">
              {totalViews} total views · when clients open your invoices
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {peakCell && (
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                Peak Cell
              </p>
              <p className="text-xs font-bold text-emerald-400 tabular-nums">
                {dayLabel(peakCell.day)} {hourLabel(peakCell.hour)} · {peakCell.count}×
              </p>
            </div>
          )}
          {peakDay !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 text-blue-400" />
                Peak Day
              </p>
              <p className="text-xs font-bold text-blue-400">{dayLabel(peakDay)}</p>
            </div>
          )}
          {peakHour !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-purple-400" />
                Peak Hour
              </p>
              <p className="text-xs font-bold text-purple-400">{hourLabel(peakHour)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <div className="min-w-[640px]">
          {/* Hour labels row */}
          <div className="flex items-center gap-0.5 mb-1">
            <div className="w-10 flex-shrink-0" />
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className={`flex-1 min-w-[20px] text-center text-[8px] font-bold tabular-nums ${
                  labelHours.includes(h) ? 'text-zinc-500' : 'text-transparent'
                }`}
              >
                {labelHours.includes(h) ? hourLabel(h) : '00'}
              </div>
            ))}
            <div className="w-10 flex-shrink-0" />
          </div>

          {/* Day rows */}
          {DAYS.map((dayName, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-10 flex-shrink-0 text-[9px] font-bold text-zinc-500 text-right pr-1">
                {dayName}
              </div>
              {Array.from({ length: 24 }).map((_, hourIdx) => {
                const count = grid[dayIdx][hourIdx];
                const isPeak = peakCell?.day === dayIdx && peakCell?.hour === hourIdx;
                return (
                  <div
                    key={hourIdx}
                    onMouseEnter={() => setHoveredCell({ day: dayIdx, hour: hourIdx, count })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`flex-1 min-w-[20px] h-6 rounded-sm border transition-all cursor-pointer hover:scale-110 hover:z-10 relative ${cellColor(count)} ${
                      isPeak ? 'ring-2 ring-emerald-300 ring-offset-1 ring-offset-[#0a0a0c]' : ''
                    }`}
                    title={`${dayName} ${hourLabel(hourIdx)} · ${count} view${count === 1 ? '' : 's'}`}
                  />
                );
              })}
              {/* Day total */}
              <div className="w-10 flex-shrink-0 text-[10px] font-bold text-zinc-400 text-right pl-1 tabular-nums">
                {dayTotals[dayIdx] > 0 ? dayTotals[dayIdx] : ''}
              </div>
            </div>
          ))}

          {/* Hour totals row */}
          <div className="flex items-center gap-0.5 mt-1">
            <div className="w-10 flex-shrink-0" />
            {hourTotals.map((total, h) => (
              <div
                key={h}
                className={`flex-1 min-w-[20px] text-center text-[8px] font-bold tabular-nums ${
                  total > 0 ? 'text-zinc-400' : 'text-transparent'
                }`}
              >
                {total > 0 ? total : '·'}
              </div>
            ))}
            <div className="w-10 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Legend + hovered cell info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-[#252529]/40">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-[#1a1a1f] border border-[#252529]/30" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/15 border border-emerald-400/20" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-400/30" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/50 border border-emerald-400/50" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/70 border border-emerald-400/70" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/90 border-emerald-400" />
          </div>
          <span>More</span>
        </div>
        <div className="text-[10px] text-zinc-500 min-h-[16px]">
          {hoveredCell ? (
            <span className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-zinc-300 font-semibold">
                {DAYS[hoveredCell.day]} {hourLabel(hoveredCell.hour)}
              </span>
              <span className="text-zinc-500">·</span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {hoveredCell.count} view{hoveredCell.count === 1 ? '' : 's'}
              </span>
            </span>
          ) : (
            <span className="text-zinc-600">Hover any cell for details</span>
          )}
        </div>
      </div>
    </div>
  );
}
