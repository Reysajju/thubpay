'use client';

import { useMemo, useState } from 'react';
import { GitCompare, Activity, Eye, EyeOff, TrendingUp } from 'lucide-react';

interface TrendPoint {
  id: string;
  status: string;
  status_code: number | null;
  duration_ms: number | null;
  attempted_at: string;
  event_type: string | null;
}

interface EndpointMeta {
  id: string;
  label: string;
  url: string;
  trend: TrendPoint[];
}

interface Props {
  endpoints: EndpointMeta[];
}

// Distinct colors for each endpoint overlay (cycling palette)
const COLORS = [
  { name: 'emerald', bar: 'bg-emerald-400', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  { name: 'cyan', bar: 'bg-cyan-400', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  { name: 'purple', bar: 'bg-purple-400', text: 'text-purple-400', dot: 'bg-purple-400' },
  { name: 'amber', bar: 'bg-amber-400', text: 'text-amber-400', dot: 'bg-amber-400' },
  { name: 'pink', bar: 'bg-pink-400', text: 'text-pink-400', dot: 'bg-pink-400' },
  { name: 'cyan', bar: 'bg-cyan-400', text: 'text-cyan-400', dot: 'bg-cyan-400' },
];

/**
 * Comparison overlay chart that shows delivery trends for multiple
 * endpoints side-by-side in a single visualization.
 *
 * Each endpoint gets its own color. The chart stacks the last N
 * deliveries per endpoint in a horizontal lane, so you can visually
 * compare:
 *   - Which endpoint receives the most events
 *   - Which endpoint has the most failures
 *   - Latency patterns across endpoints
 *
 * Toggle endpoints on/off via the legend chips above the chart.
 */
export default function EndpointComparisonChart({ endpoints }: Props) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleEndpoints = useMemo(
    () => endpoints.filter((ep) => !hiddenIds.has(ep.id)),
    [endpoints, hiddenIds]
  );

  // Compute global max latency for normalizing bar heights across endpoints
  const globalMaxLatency = useMemo(() => {
    let max = 0;
    for (const ep of visibleEndpoints) {
      for (const d of ep.trend) {
        if (d.duration_ms != null && d.duration_ms > max) max = d.duration_ms;
      }
    }
    return max || 1;
  }, [visibleEndpoints]);

  if (endpoints.length < 2) {
    return null;
  }

  function toggleEndpoint(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Aggregate stats per endpoint (for the right-side summary)
  const endpointStats = visibleEndpoints.map((ep, idx) => {
    const trend = ep.trend;
    const total = trend.length;
    const ok = trend.filter((d) => d.status === 'ok').length;
    const failed = trend.filter((d) => d.status === 'failed').length;
    const latencies = trend.filter((d) => d.duration_ms != null).map((d) => d.duration_ms!);
    const avg = latencies.length > 0 ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length) : null;
    const successRate = total > 0 ? Math.round((ok / total) * 100) : 0;
    return {
      ...ep,
      color: COLORS[idx % COLORS.length],
      total,
      ok,
      failed,
      avg,
      successRate,
    };
  });

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 mt-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/15 to-cyan-500/15 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Endpoint Comparison</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Side-by-side delivery trends across {endpoints.length} endpoints
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-[#252529]">
          {visibleEndpoints.length} visible
        </span>
      </div>

      {/* Legend / toggle chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {endpoints.map((ep, idx) => {
          const isHidden = hiddenIds.has(ep.id);
          const color = COLORS[idx % COLORS.length];
          return (
            <button
              key={ep.id}
              onClick={() => toggleEndpoint(ep.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                isHidden
                  ? 'bg-[#1a1a1f] border-[#252529] text-zinc-600 opacity-50 hover:opacity-80'
                  : `bg-[#0a0a0c] ${color.text} border-current/30`
              }`}
              title={isHidden ? 'Show this endpoint' : 'Hide this endpoint'}
            >
              <span className={`w-2 h-2 rounded-full ${isHidden ? 'bg-zinc-700' : color.dot}`} />
              <span className="truncate max-w-[120px]">{ep.label}</span>
              {isHidden ? (
                <EyeOff className="w-2.5 h-2.5 ml-0.5" />
              ) : (
                <Eye className="w-2.5 h-2.5 ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Chart: one lane per endpoint */}
      <div className="space-y-3">
        {endpointStats.map((ep) => {
          const trend = ep.trend;
          const maxBarHeight = 32; // px
          return (
            <div key={ep.id} className="flex items-center gap-3">
              {/* Endpoint label */}
              <div className="flex-shrink-0 w-32 sm:w-40">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-2 h-2 rounded-full ${ep.color.dot} flex-shrink-0`} />
                  <span className="text-[11px] font-bold text-white truncate">{ep.label}</span>
                </div>
                <p className={`text-[10px] font-bold tabular-nums ${ep.color.text}`}>
                  {ep.successRate}% · {ep.ok}/{ep.total}
                </p>
              </div>

              {/* Bars lane */}
              <div className="flex-1 min-w-0">
                <div className="flex items-end gap-0.5 h-10 bg-[#0a0a0c]/40 rounded-md p-1 overflow-hidden">
                  {trend.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-600">
                      no deliveries
                    </div>
                  ) : (
                    trend.map((d) => {
                      const latency = d.duration_ms ?? 0;
                      const heightPct = (latency / globalMaxLatency) * 100;
                      const heightPx = Math.max(3, (heightPct / 100) * maxBarHeight);
                      const isOk = d.status === 'ok';
                      const isFailed = d.status === 'failed';
                      const attemptedAt = new Date(d.attempted_at);
                      // Use the endpoint's color, but dim for failures
                      const barClass = isOk
                        ? `${ep.color.bar}`
                        : isFailed
                          ? 'bg-red-400'
                          : 'bg-amber-400';
                      return (
                        <div
                          key={d.id}
                          className={`flex-1 min-w-[2px] max-w-[6px] rounded-sm ${barClass} hover:opacity-80 transition-opacity relative group`}
                          style={{ height: `${heightPx}px` }}
                          title={`${ep.label}\n${attemptedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}\nstatus: ${d.status}${d.status_code ? ` (${d.status_code})` : ''}${d.duration_ms != null ? `\nlatency: ${d.duration_ms}ms` : ''}`}
                        >
                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 pointer-events-none">
                            <div className="bg-[#131316] border border-[#252529] rounded-md p-1.5 shadow-xl whitespace-nowrap">
                              <p className={`text-[9px] font-bold ${ep.color.text}`}>{ep.label}</p>
                              <p className="text-[9px] text-zinc-300">
                                {attemptedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className={`text-[9px] font-bold ${isOk ? 'text-emerald-400' : 'text-red-400'}`}>
                                {d.status}{d.status_code ? ` · ${d.status_code}` : ''}
                              </p>
                              {d.duration_ms != null && (
                                <p className="text-[9px] text-zinc-400 font-mono">{d.duration_ms}ms</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Avg latency */}
              <div className="flex-shrink-0 w-16 text-right">
                {ep.avg != null ? (
                  <>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">avg</p>
                    <p className={`text-xs font-bold tabular-nums ${ep.color.text}`}>{ep.avg}ms</p>
                  </>
                ) : (
                  <p className="text-[10px] text-zinc-700">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {endpointStats.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#252529]/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
          <div>
            <p className="text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Endpoints</p>
            <p className="text-white font-bold tabular-nums">{visibleEndpoints.length}</p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Total Deliveries</p>
            <p className="text-white font-bold tabular-nums">
              {endpointStats.reduce((s, ep) => s + ep.total, 0)}
            </p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Best Success</p>
            <p className="text-emerald-400 font-bold tabular-nums">
              {Math.max(...endpointStats.map((ep) => ep.successRate), 0)}%
            </p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Fastest Avg</p>
            <p className="text-emerald-400 font-bold tabular-nums">
              {(() => {
                const avgs = endpointStats.map((ep) => ep.avg).filter((a): a is number => a != null);
                return avgs.length > 0 ? `${Math.min(...avgs)}ms` : '—';
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
