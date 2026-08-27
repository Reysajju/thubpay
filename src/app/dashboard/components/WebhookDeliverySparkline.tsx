'use client';

import { useMemo } from 'react';
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';

interface TrendPoint {
  id: string;
  status: string;
  status_code: number | null;
  duration_ms: number | null;
  attempted_at: string;
  event_type: string | null;
  error?: string | null;
}

interface Props {
  endpointId: string;
  endpointLabel: string;
  deliveries: TrendPoint[];
}

/**
 * Mini sparkline chart showing the last N webhook deliveries for an endpoint.
 * Each bar represents one delivery, colored by status:
 *   - emerald = ok (2xx)
 *   - amber = pending
 *   - red = failed (non-2xx or connection error)
 *
 * Bar HEIGHT encodes latency (taller = slower). Hovering shows a tooltip
 * with the full delivery details.
 *
 * Renders inline inside the endpoint card.
 */
export default function WebhookDeliverySparkline({ endpointId, endpointLabel, deliveries }: Props) {
  const stats = useMemo(() => {
    if (deliveries.length === 0) return null;
    const ok = deliveries.filter((d) => d.status === 'ok').length;
    const failed = deliveries.filter((d) => d.status === 'failed').length;
    const latencies = deliveries
      .filter((d) => d.duration_ms != null)
      .map((d) => d.duration_ms!);
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
        : null;
    return {
      total: deliveries.length,
      ok,
      failed,
      maxLatency,
      avgLatency,
      successRate: deliveries.length > 0 ? Math.round((ok / deliveries.length) * 100) : 0,
    };
  }, [deliveries]);

  if (deliveries.length === 0 || !stats) {
    return null;
  }

  const successColor =
    stats.successRate >= 95
      ? 'text-emerald-400'
      : stats.successRate >= 80
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="mt-3 p-3 rounded-lg bg-[#0a0a0c]/60 border border-[#252529]/40">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
          <Activity className="w-2.5 h-2.5" />
          Delivery Trend · last {deliveries.length}
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500">
            <span className={`font-bold tabular-nums ${successColor}`}>{stats.successRate}%</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-zinc-400 tabular-nums">{stats.ok}/{stats.total}</span>
          </span>
          {stats.avgLatency != null && (
            <span className="text-zinc-500">
              <span className="text-zinc-600">avg</span>{' '}
              <span className="text-zinc-300 font-mono tabular-nums">{stats.avgLatency}ms</span>
            </span>
          )}
        </div>
      </div>

      {/* Sparkline bars */}
      <div className="flex items-end gap-0.5 h-10" role="img" aria-label={`Delivery trend for ${endpointLabel}`}>
        {deliveries.map((d, i) => {
          const latency = d.duration_ms ?? 0;
          const heightPct = stats.maxLatency > 0 ? Math.max(8, (latency / stats.maxLatency) * 100) : 30;
          const isOk = d.status === 'ok';
          const isFailed = d.status === 'failed';
          const barColor = isOk
            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
            : isFailed
              ? 'bg-gradient-to-t from-red-600 to-red-400'
              : 'bg-gradient-to-t from-amber-600 to-amber-400';
          const attemptedAt = new Date(d.attempted_at);
          const tooltip = [
            `#${i + 1}`,
            attemptedAt.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            `status: ${d.status}${d.status_code ? ` (${d.status_code})` : ''}`,
            d.duration_ms != null ? `latency: ${d.duration_ms}ms` : 'latency: —',
            d.event_type ? `event: ${d.event_type}` : null,
            d.error ? `error: ${d.error}` : null,
          ].filter(Boolean).join('\n');
          return (
            <div
              key={d.id}
              className={`flex-1 min-w-[3px] max-w-[8px] rounded-sm ${barColor} hover:opacity-80 transition-opacity relative group`}
              style={{ height: `${heightPct}%` }}
              title={tooltip}
            >
              {/* Hover tooltip */}
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 pointer-events-none">
                <div className="bg-[#131316] border border-[#252529] rounded-md p-2 shadow-xl whitespace-nowrap">
                  <p className="text-[9px] font-bold text-zinc-300">
                    {attemptedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className={`text-[9px] font-bold ${isOk ? 'text-emerald-400' : isFailed ? 'text-red-400' : 'text-amber-400'}`}>
                    {d.status}{d.status_code ? ` · ${d.status_code}` : ''}
                  </p>
                  {d.duration_ms != null && (
                    <p className="text-[9px] text-zinc-400 font-mono">{d.duration_ms}ms</p>
                  )}
                  {d.event_type && (
                    <p className="text-[9px] text-zinc-500 font-mono">{d.event_type}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time axis hint */}
      <div className="flex items-center justify-between mt-1.5 text-[9px] text-zinc-600">
        <span className="flex items-center gap-0.5">
          <TrendingUp className="w-2 h-2" />
          {new Date(deliveries[0].attempted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span>
          {new Date(deliveries[deliveries.length - 1].attempted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#252529]/40 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-400" />
          ok ({stats.ok})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-400" />
          failed ({stats.failed})
        </span>
        {stats.maxLatency > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-2 h-2 text-amber-400" />
            max {stats.maxLatency}ms
          </span>
        )}
      </div>
    </div>
  );
}
