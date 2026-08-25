'use client';

import { useMemo, useState } from 'react';
import { LineChart, TrendingUp, Clock, Zap, Eye, EyeOff } from 'lucide-react';

interface TrendPoint {
  id: string;
  status: string;
  status_code: number | null;
  duration_ms: number | null;
  attempted_at: string;
  event_type: string | null;
  error?: string | null;
}

interface EndpointMeta {
  id: string;
  label: string;
  trend: TrendPoint[];
}

interface Props {
  endpoints: EndpointMeta[];
}

// Distinct colors for each endpoint overlay (cycling palette)
const COLORS = [
  { name: 'emerald', stroke: '#34D399', fill: 'rgba(52, 211, 153, 0.15)', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  { name: 'blue', stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.15)', text: 'text-blue-400', dot: 'bg-blue-400' },
  { name: 'purple', stroke: '#c084fc', fill: 'rgba(192, 132, 252, 0.15)', text: 'text-purple-400', dot: 'bg-purple-400' },
  { name: 'amber', stroke: '#fbbf24', fill: 'rgba(251, 191, 36, 0.15)', text: 'text-amber-400', dot: 'bg-amber-400' },
  { name: 'pink', stroke: '#f472b6', fill: 'rgba(244, 114, 182, 0.15)', text: 'text-pink-400', dot: 'bg-pink-400' },
  { name: 'cyan', stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.15)', text: 'text-cyan-400', dot: 'bg-cyan-400' },
];

const SVG_WIDTH = 800;
const SVG_HEIGHT = 220;
const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };
const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;

/**
 * Per-endpoint delivery latency overlay line chart.
 *
 * Renders an SVG line chart showing the latency (ms) of each delivery
 * over time, with one colored line per endpoint. Failed deliveries are
 * marked as red dots on the line.
 *
 * Toggle endpoints on/off via the legend chips above the chart.
 *
 * Shows:
 *   - Y-axis: latency in ms (auto-scaled to global max)
 *   - X-axis: delivery index (0..N)
 *   - One smooth line per endpoint (colored)
 *   - Red dots for failed deliveries
 *   - Hover tooltip on each data point
 */
export default function LatencyOverlayChart({ endpoints }: Props) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleEndpoints = useMemo(
    () => endpoints.filter((ep) => !hiddenIds.has(ep.id)),
    [endpoints, hiddenIds]
  );

  // Global max latency across all visible endpoints (for Y-axis scaling)
  const globalMaxLatency = useMemo(() => {
    let max = 100; // default min scale
    for (const ep of visibleEndpoints) {
      for (const d of ep.trend) {
        if (d.duration_ms != null && d.duration_ms > max) max = d.duration_ms;
      }
    }
    return max;
  }, [visibleEndpoints]);

  // Max deliveries count across visible endpoints (for X-axis scaling)
  const maxDeliveries = useMemo(() => {
    let max = 1;
    for (const ep of visibleEndpoints) {
      if (ep.trend.length > max) max = ep.trend.length;
    }
    return max;
  }, [visibleEndpoints]);

  if (endpoints.length < 2) return null;

  function toggleEndpoint(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build SVG path data for each endpoint
  function buildPath(trend: TrendPoint[]): string {
    if (trend.length === 0) return '';
    const points = trend.map((d, i) => {
      const x = PADDING.left + (maxDeliveries > 1 ? (i / (maxDeliveries - 1)) * CHART_WIDTH : CHART_WIDTH / 2);
      const latency = d.duration_ms ?? 0;
      const y = PADDING.top + CHART_HEIGHT - (latency / globalMaxLatency) * CHART_HEIGHT;
      return { x, y, d };
    });

    // Build a smooth path using simple line segments (SVG path syntax)
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  // Y-axis tick marks (5 ticks)
  const yTicks = Array.from({ length: 5 }).map((_, i) => {
    const value = Math.round((globalMaxLatency / 4) * i);
    const y = PADDING.top + CHART_HEIGHT - (i / 4) * CHART_HEIGHT;
    return { value, y };
  });

  // Aggregate stats per endpoint
  const endpointStats = visibleEndpoints.map((ep, idx) => {
    const trend = ep.trend;
    const latencies = trend.filter((d) => d.duration_ms != null).map((d) => d.duration_ms!);
    const avg = latencies.length > 0 ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length) : null;
    const max = latencies.length > 0 ? Math.max(...latencies) : null;
    const min = latencies.length > 0 ? Math.min(...latencies) : null;
    const failed = trend.filter((d) => d.status === 'failed').length;
    const successRate = trend.length > 0 ? Math.round(((trend.length - failed) / trend.length) * 100) : 0;
    return {
      ...ep,
      color: COLORS[idx % COLORS.length],
      avg,
      max,
      min,
      failed,
      successRate,
      total: trend.length,
    };
  });

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 mt-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-purple-500/15 flex items-center justify-center">
            <LineChart className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Latency Overlay</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Delivery latency (ms) over time · {endpoints.length} endpoints compared
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
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isHidden ? '#3f3f46' : color.stroke }} />
              <span className="truncate max-w-[120px]">{ep.label}</span>
              {isHidden ? <EyeOff className="w-2.5 h-2.5 ml-0.5" /> : <Eye className="w-2.5 h-2.5 ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* SVG chart */}
      <div className="overflow-x-auto custom-scrollbar">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full min-w-[600px] h-[220px]"
          role="img"
          aria-label="Latency overlay chart"
        >
          {/* Y-axis grid lines + labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PADDING.left}
                y1={tick.y}
                x2={SVG_WIDTH - PADDING.right}
                y2={tick.y}
                stroke="#252529"
                strokeWidth="1"
                strokeDasharray={i === 0 ? '0' : '2,3'}
              />
              <text
                x={PADDING.left - 8}
                y={tick.y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#71717a"
                fontFamily="monospace"
              >
                {tick.value}ms
              </text>
            </g>
          ))}

          {/* X-axis */}
          <line
            x1={PADDING.left}
            y1={PADDING.top + CHART_HEIGHT}
            x2={SVG_WIDTH - PADDING.right}
            y2={PADDING.top + CHART_HEIGHT}
            stroke="#252529"
            strokeWidth="1"
          />

          {/* X-axis label */}
          <text
            x={PADDING.left + CHART_WIDTH / 2}
            y={SVG_HEIGHT - 5}
            textAnchor="middle"
            fontSize="9"
            fill="#71717a"
          >
            delivery index (oldest → newest)
          </text>

          {/* Render each endpoint's line + dots */}
          {endpointStats.map((ep) => {
            const path = buildPath(ep.trend);
            return (
              <g key={ep.id}>
                {/* Filled area under the line */}
                {path && (
                  <path
                    d={`${path} L ${PADDING.left + (maxDeliveries > 1 ? CHART_WIDTH : CHART_WIDTH / 2)} ${PADDING.top + CHART_HEIGHT} L ${PADDING.left} ${PADDING.top + CHART_HEIGHT} Z`}
                    fill={ep.color.fill}
                    opacity="0.6"
                  />
                )}
                {/* Line */}
                {path && (
                  <path
                    d={path}
                    fill="none"
                    stroke={ep.color.stroke}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {/* Data points (dots) */}
                {ep.trend.map((d, i) => {
                  const x = PADDING.left + (maxDeliveries > 1 ? (i / (maxDeliveries - 1)) * CHART_WIDTH : CHART_WIDTH / 2);
                  const latency = d.duration_ms ?? 0;
                  const y = PADDING.top + CHART_HEIGHT - (latency / globalMaxLatency) * CHART_HEIGHT;
                  const isFailed = d.status === 'failed';
                  return (
                    <g key={d.id} className="group">
                      <circle
                        cx={x}
                        cy={y}
                        r={isFailed ? 4 : 3}
                        fill={isFailed ? '#f87171' : ep.color.stroke}
                        stroke={isFailed ? '#fca5a5' : ep.color.stroke}
                        strokeWidth="1"
                        className="cursor-pointer transition-transform group-hover:scale-150"
                        style={{ transformOrigin: 'center', transformBox: 'fill-box' } as any}
                      >
                        <title>
                          {ep.label}
                          {'\n'}
                          {new Date(d.attempted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {'\n'}
                          status: {d.status}{d.status_code ? ` (${d.status_code})` : ''}
                          {'\n'}
                          latency: {d.duration_ms ?? '—'}ms
                          {d.error ? `\nerror: ${d.error}` : ''}
                        </title>
                      </circle>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Per-endpoint stats summary */}
      <div className="mt-4 pt-3 border-t border-[#252529]/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {endpointStats.map((ep) => (
          <div
            key={ep.id}
            className="p-2.5 rounded-lg bg-[#0a0a0c]/60 border border-[#252529]/40 flex items-center gap-2"
          >
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ep.color.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{ep.label}</p>
              <div className="flex items-center gap-2 text-[9px] text-zinc-500 mt-0.5">
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2 h-2" />
                  <span className="font-mono tabular-nums text-zinc-400">
                    avg {ep.avg ?? '—'}ms
                  </span>
                </span>
                <span className="flex items-center gap-0.5">
                  <Zap className="w-2 h-2" />
                  <span className="font-mono tabular-nums text-zinc-400">
                    max {ep.max ?? '—'}ms
                  </span>
                </span>
                {ep.failed > 0 && (
                  <span className="text-red-400 font-bold tabular-nums">{ep.failed} fail</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">SR</p>
              <p className={`text-xs font-bold tabular-nums ${
                ep.successRate >= 95 ? 'text-emerald-400' : ep.successRate >= 80 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {ep.successRate}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
