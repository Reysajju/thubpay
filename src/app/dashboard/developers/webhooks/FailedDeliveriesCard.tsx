'use client';

// ─────────────────────────────────────────────────────────────
// Phase 6 #3: Failed Deliveries & Retries card
// Client component — supports manual "Retry now" button per delivery.
// ─────────────────────────────────────────────────────────────

import React from 'react';

export interface FailedDelivery {
  id: string;
  statusCode: number | null;
  status: string;
  error: string | null;
  attempts: number;
  nextRetryAt: string | Date | null;
  idempotencyKey: string | null;
  attemptedAt: string | Date;
  durationMs: number | null;
  webhookEvent: { eventType: string; gateway: string | null } | null;
  webhookEndpoint: { label: string; url: string } | null;
}

function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function FailedDeliveriesCard({
  failedDeliveries,
}: {
  failedDeliveries: FailedDelivery[];
}) {
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<Record<string, { ok: boolean; status: string; error?: string; attempts?: number } | null>>({});

  async function handleRetry(deliveryId: string) {
    setBusyIds(prev => new Set(prev).add(deliveryId));
    try {
      const res = await fetch(`/api/dashboard/webhooks/deliveries/${deliveryId}/retry`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({ ok: false, status: 'parse_error' }));
      setResults(prev => ({ ...prev, [deliveryId]: data }));
    } catch (err: any) {
      setResults(prev => ({ ...prev, [deliveryId]: { ok: false, status: 'network_error', error: err?.message } }));
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(deliveryId);
        return next;
      });
    }
  }

  return (
    <div className="glass-card rounded-2xl p-5 mt-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m6-.75a6 6 0 11-12 0 6 6 0 0112 0zm-6 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Failed Deliveries &amp; Retries</h2>
            <p className="text-[11px] text-zinc-500">
              Webhook deliveries that failed. Retries run automatically with exponential backoff.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
          {failedDeliveries.length} failing
        </span>
      </div>

      {failedDeliveries.length === 0 ? (
        <div className="py-8 text-center">
          <svg className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-zinc-300">No failed deliveries</p>
          <p className="text-xs text-zinc-600 mt-1">All webhook deliveries are succeeding</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
          {failedDeliveries.map((d, i) => {
            const isExhausted = d.attempts >= 7;
            const isRetrying = busyIds.has(d.id);
            const result = results[d.id];
            const showResult = result !== undefined && !isRetrying;
            const nextRetry = d.nextRetryAt ? new Date(d.nextRetryAt as any) : null;
            const isDue = nextRetry ? nextRetry.getTime() <= Date.now() : false;
            return (
              <div
                key={d.id}
                className={`rounded-xl bg-[#0a0a0b] border border-[#252529]/50 hover:border-red-500/20 transition-all animate-stagger stagger-${Math.min((i % 6) + 1, 6)} p-3`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-mono text-[#10B981] truncate">
                        {d.webhookEvent?.eventType ?? 'unknown'}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        isExhausted
                          ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
                          : 'bg-red-500/15 text-red-400 border-red-500/25'
                      }`}>
                        {isExhausted ? '✗ Exhausted' : '❌ Failed'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-amber-500/25 bg-amber-500/10 text-amber-400">
                        ⏱ attempt {d.attempts}/7
                      </span>
                      {d.statusCode !== null && (
                        <span className="text-[10px] font-mono text-zinc-500 bg-[#131316] px-1.5 py-0.5 rounded">
                          HTTP {d.statusCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 truncate">
                      → {d.webhookEndpoint?.label ?? 'Unknown endpoint'} <span className="font-mono text-zinc-600">({d.webhookEndpoint?.url ?? '—'})</span>
                    </p>
                    {d.error && (
                      <p className="text-[10px] text-red-400/80 mt-0.5 truncate font-mono">
                        {d.error}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      Last try: {formatDateTime(d.attemptedAt)}
                      {d.durationMs != null && ` · ${d.durationMs}ms`}
                      {nextRetry && !isExhausted && (
                        <> · Next retry: <span className={isDue ? 'text-emerald-400' : 'text-zinc-500'}>{isDue ? 'due now' : nextRetry.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {showResult && result ? (
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                        result.ok
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-red-500/10 text-red-400 border border-red-500/25'
                      }`}>
                        {result.ok ? '✓ Retry OK' : '✗ Still failing'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isExhausted || isRetrying}
                        onClick={() => handleRetry(d.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-500/50 text-emerald-400 text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover-lift"
                      >
                        {isRetrying ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                              <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            Retrying…
                          </>
                        ) : isExhausted ? (
                          <>Max attempts</>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667.666l-1.466 1.464M3.015 4.356v4.992m0 0h4.992m-4.993 0l3.181-3.183a8.25 8.25 0 0111.667-.666L21.985 8.65" />
                            </svg>
                            Retry now
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
