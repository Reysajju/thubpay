'use client';

import { useState } from 'react';
import { Activity, Heart, Loader2, CheckCircle2, XCircle, Zap, RefreshCw } from 'lucide-react';
import { pingAllWebhookEndpoints } from '@/app/dashboard/actions';

interface EndpointHealth {
  id: string;
  label: string;
  url: string;
  healthy: boolean;
  status_code: number | null;
  duration_ms: number;
  error?: string;
}

interface Props {
  endpoints: { id: string; label: string; url: string }[];
}

/**
 * Health check panel for all webhook endpoints.
 * Renders a "Run Health Check" button that pings every active endpoint
 * via HEAD requests and reports reachability + latency.
 *
 * Results show per-endpoint status (healthy/unhealthy) + HTTP status code
 * + response time. Aggregated summary at the top shows healthy/total ratio.
 */
export default function HealthCheckPanel({ endpoints }: Props) {
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<EndpointHealth[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; healthy: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleHealthCheck() {
    setPending(true);
    setError(null);
    try {
      const res = (await pingAllWebhookEndpoints()) as any;
      if (res?.success) {
        // Merge the ping results with endpoint metadata
        const merged: EndpointHealth[] = (res.results || []).map((r: any) => {
          const ep = endpoints.find((e) => e.id === r.id);
          return {
            id: r.id,
            label: ep?.label || 'Unknown',
            url: ep?.url || '',
            healthy: r.healthy,
            status_code: r.status_code,
            duration_ms: r.duration_ms,
            error: r.error,
          };
        });
        setResults(merged);
        setSummary({ total: res.total, healthy: res.healthy, failed: res.failed });
      } else {
        setError(res?.error || 'Health check failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setPending(false);
    }
  }

  if (endpoints.length === 0) {
    return null;
  }

  const healthyCount = summary?.healthy ?? 0;
  const totalCount = summary?.total ?? endpoints.length;
  const healthRate = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;
  const allHealthy = results && healthyCount === totalCount && totalCount > 0;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 mb-6 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            results
              ? allHealthy
                ? 'bg-emerald-500/15'
                : healthyCount > 0
                  ? 'bg-amber-500/15'
                  : 'bg-red-500/15'
              : 'bg-[#10B981]/10'
          }`}>
            {pending ? (
              <Loader2 className="w-5 h-5 text-[#10B981] animate-spin" />
            ) : results ? (
              allHealthy ? (
                <Heart className="w-5 h-5 text-emerald-400" />
              ) : healthyCount > 0 ? (
                <Activity className="w-5 h-5 text-amber-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )
            ) : (
              <Heart className="w-5 h-5 text-[#10B981]" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Endpoint Health Check</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ping all active endpoints to verify reachability + measure latency
            </p>
          </div>
        </div>
        <button
          onClick={handleHealthCheck}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5 hover:bg-[#10B981]/10 hover:border-[#10B981]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {pending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Pinging…
            </>
          ) : results ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Re-check
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Run Health Check
            </>
          )}
        </button>
      </div>

      {/* Summary card (after first check) */}
      {results && summary && (
        <div
          className={`mb-4 p-3 rounded-xl border animate-scaleIn ${
            allHealthy
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : healthyCount > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {allHealthy ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-400" />
              )}
              <p className={`text-sm font-bold ${
                allHealthy ? 'text-emerald-300' : 'text-amber-300'
              }`}>
                {allHealthy
                  ? `All ${totalCount} endpoints are healthy`
                  : `${healthyCount}/${totalCount} endpoints healthy`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold tabular-nums">{healthyCount}</span> ok
              </span>
              {summary.failed > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="font-bold tabular-nums">{summary.failed}</span> failed
                </span>
              )}
              <span className="text-zinc-500">
                <span className="font-bold text-white tabular-nums">{healthRate}%</span> uptime
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Per-endpoint results */}
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={r.id}
              className={`p-3 rounded-xl border flex items-center gap-3 animate-stagger stagger-${Math.min(i + 1, 6)} ${
                r.healthy
                  ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                  : 'bg-red-500/[0.04] border-red-500/30'
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  r.healthy ? 'bg-emerald-500/10' : 'bg-red-500/10'
                }`}
              >
                {r.healthy ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-white truncate">{r.label}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    r.healthy
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}>
                    {r.healthy ? 'HEALTHY' : 'UNHEALTHY'}
                  </span>
                </div>
                <code className="text-[10px] text-zinc-500 break-all">{r.url}</code>
                {r.error && (
                  <p className="text-[10px] text-red-400/80 mt-1 truncate">{r.error}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                {r.status_code != null && (
                  <p className={`text-xs font-bold tabular-nums ${
                    r.status_code >= 200 && r.status_code < 300
                      ? 'text-emerald-400'
                      : r.status_code >= 400 && r.status_code < 500
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}>
                    {r.status_code}
                  </p>
                )}
                <p className="text-[10px] text-zinc-500 font-mono tabular-nums">
                  {r.duration_ms}ms
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 animate-scaleIn">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Hint when no check has run yet */}
      {!results && !error && !pending && (
        <div className="p-3 rounded-xl bg-[#0a0a0c]/60 border border-[#252529]/40 text-xs text-zinc-500">
          Click <span className="text-[#10B981] font-semibold">Run Health Check</span> to ping all{' '}
          <span className="text-zinc-300 font-bold">{endpoints.length}</span> active endpoint{endpoints.length === 1 ? '' : 's'} via HEAD requests.
          Results show reachability + HTTP status + response latency.
        </div>
      )}
    </div>
  );
}
