'use client';

import { useMemo, useState } from 'react';
import { Activity, Clock, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Zap } from 'lucide-react';

interface HistoryPoint {
  id: string;
  status: string;
  status_code: number | null;
  duration_ms: number | null;
  error: string | null;
  triggered_by: string;
  checked_at: string;
}

interface Props {
  endpointId: string;
  endpointLabel: string;
  totalChecks: number;
  healthyChecks: number;
  unhealthyChecks: number;
  uptimeRate: number;
  avgLatencyMs: number | null;
  lastCheckAt: string | null;
  lastStatus: string | null;
  history: HistoryPoint[];
}

/**
 * Uptime history chart for a single webhook endpoint.
 *
 * Renders a horizontal strip of colored squares (one per health check),
 * colored by status:
 *   - emerald = healthy
 *   - red = unhealthy
 *
 * Hovering any square shows a tooltip with the full check details
 * (timestamp, status code, latency, error, triggered by).
 *
 * Below the strip: aggregate stats (uptime %, total checks, avg latency)
 * + a latency sparkline showing response time trend.
 */
export default function UptimeHistoryChart({
  endpointId,
  endpointLabel,
  totalChecks,
  healthyChecks,
  unhealthyChecks,
  uptimeRate,
  avgLatencyMs,
  lastCheckAt,
  lastStatus,
  history,
}: Props) {
  const [hovered, setHovered] = useState<HistoryPoint | null>(null);

  const maxLatency = useMemo(() => {
    let m = 0;
    for (const h of history) {
      if (h.duration_ms != null && h.duration_ms > m) m = h.duration_ms;
    }
    return m;
  }, [history]);

  if (totalChecks === 0) {
    return null;
  }

  const rateColor =
    uptimeRate >= 95
      ? 'text-emerald-400'
      : uptimeRate >= 80
        ? 'text-amber-400'
        : 'text-red-400';

  const lastCheckLabel = lastCheckAt
    ? new Date(lastCheckAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'never';

  return (
    <div className="mt-3 p-3 rounded-lg bg-[#0a0a0c]/60 border border-[#252529]/40">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
          <Activity className="w-2.5 h-2.5" />
          Uptime History · last {history.length} checks
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`font-bold tabular-nums ${rateColor}`}>
            {uptimeRate}% uptime
          </span>
          {avgLatencyMs != null && (
            <span className="text-zinc-500">
              <span className="text-zinc-600">avg</span>{' '}
              <span className="text-zinc-300 font-mono tabular-nums">{avgLatencyMs}ms</span>
            </span>
          )}
        </div>
      </div>

      {/* Uptime strip — colored squares */}
      <div className="flex items-center gap-0.5 h-6 overflow-x-auto custom-scrollbar pb-1">
        {history.map((h) => {
          const isHealthy = h.status === 'healthy';
          const latency = h.duration_ms ?? 0;
          // For healthy checks, opacity encodes latency (faster = more opaque)
          const latencyRatio = maxLatency > 0 ? latency / maxLatency : 0;
          const opacity = isHealthy
            ? Math.max(0.35, 1 - latencyRatio * 0.5) // healthy: 0.35-1.0
            : 1; // unhealthy: full opacity red
          const checkedAt = new Date(h.checked_at);
          return (
            <div
              key={h.id}
              onMouseEnter={() => setHovered(h)}
              onMouseLeave={() => setHovered(null)}
              className={`flex-shrink-0 w-2.5 h-5 rounded-sm cursor-pointer transition-transform hover:scale-y-110 relative group ${
                isHealthy ? 'bg-emerald-400' : 'bg-red-400'
              }`}
              style={{ opacity }}
              title={`${checkedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${h.status}${h.status_code ? ` (${h.status_code})` : ''}${h.duration_ms != null ? ` · ${h.duration_ms}ms` : ''}${h.error ? ` · ${h.error}` : ''}`}
            />
          );
        })}
      </div>

      {/* Hovered check details */}
      <div className="mt-2 text-[10px] text-zinc-500 min-h-[14px]">
        {hovered ? (
          <span className="flex items-center gap-2">
            {hovered.status === 'healthy' ? (
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <XCircle className="w-2.5 h-2.5 text-red-400" />
            )}
            <span className="text-zinc-300 font-semibold">
              {new Date(hovered.checked_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="text-zinc-600">·</span>
            <span className={hovered.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'}>
              {hovered.status_code ? `${hovered.status_code}` : 'ERR'}
            </span>
            {hovered.duration_ms != null && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400 font-mono tabular-nums">{hovered.duration_ms}ms</span>
              </>
            )}
            {hovered.triggered_by === 'scheduled' && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500 flex items-center gap-0.5">
                  <Zap className="w-2 h-2" />
                  auto
                </span>
              </>
            )}
            {hovered.error && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-red-400/80">{hovered.error.slice(0, 60)}</span>
              </>
            )}
          </span>
        ) : (
          <span className="text-zinc-600">
            Hover any square for details · last check: <span className="text-zinc-400">{lastCheckLabel}</span>
          </span>
        )}
      </div>

      {/* Summary footer */}
      <div className="mt-2 pt-2 border-t border-[#252529]/40 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-zinc-500">
            <span className="w-2 h-2 rounded-sm bg-emerald-400" />
            <span className="text-emerald-400 font-bold tabular-nums">{healthyChecks}</span> ok
          </span>
          {unhealthyChecks > 0 && (
            <span className="flex items-center gap-1 text-zinc-500">
              <span className="w-2 h-2 rounded-sm bg-red-400" />
              <span className="text-red-400 font-bold tabular-nums">{unhealthyChecks}</span> failed
            </span>
          )}
        </div>
        <span className="text-zinc-600">
          {totalChecks} total checks
        </span>
      </div>
    </div>
  );
}
