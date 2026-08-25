'use client';

import { useState } from 'react';
import { Bell, Loader2, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { triggerReminderSweep } from '@/app/dashboard/actions';

interface SweepResult {
  success: boolean;
  scanned?: number;
  remindersSent?: number;
  byTier?: Record<string, number>;
  invoicesMarkedOverdue?: number;
  error?: string;
}

export default function ReminderPanel({
  notViewedCount,
}: {
  notViewedCount: number;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SweepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSweep() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = (await triggerReminderSweep()) as SweepResult;
      if (res?.success) {
        setResult(res);
      } else {
        setError(res?.error || 'Sweep failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#34D399] flex items-center justify-center">
            <Bell className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Auto-Reminders</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Smart nudge system for unviewed invoices
            </p>
          </div>
        </div>
        <button
          onClick={handleSweep}
          disabled={pending || notViewedCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5 hover:bg-[#10B981]/10 hover:border-[#10B981]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {pending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Sweeping…
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Run sweep now
            </>
          )}
        </button>
      </div>

      {/* Tier legend */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          {
            tier: '1 day',
            label: 'Gentle nudge',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
          },
          {
            tier: '3 days',
            label: 'Follow-up',
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/20',
          },
          {
            tier: '7 days',
            label: 'Final + overdue',
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
          },
        ].map((t) => (
          <div
            key={t.tier}
            className={`p-2.5 rounded-xl border ${t.border} ${t.bg}`}
          >
            <p className={`text-[10px] font-bold ${t.color} uppercase tracking-wider`}>
              {t.tier}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Status */}
      {notViewedCount === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-300">
            Every sent invoice has been opened. No reminders needed.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-amber-300 font-semibold">
              {notViewedCount} unviewed invoice{notViewedCount === 1 ? '' : 's'} may need follow-up
            </p>
            <p className="text-[11px] text-amber-200/70 mt-0.5">
              Click &ldquo;Run sweep now&rdquo; to scan all sent invoices and generate reminders
              for any that haven&apos;t been opened within the tier windows.
            </p>
          </div>
        </div>
      )}

      {/* Sweep result */}
      {result && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 animate-scaleIn">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-bold text-emerald-300">
              Sweep complete
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <p className="text-zinc-500">Scanned</p>
              <p className="text-white font-bold">{result.scanned ?? 0}</p>
            </div>
            <div>
              <p className="text-zinc-500">Reminders</p>
              <p className="text-emerald-400 font-bold">{result.remindersSent ?? 0}</p>
            </div>
            <div>
              <p className="text-zinc-500">Marked overdue</p>
              <p className="text-red-400 font-bold">{result.invoicesMarkedOverdue ?? 0}</p>
            </div>
            <div>
              <p className="text-zinc-500">By tier</p>
              <p className="text-zinc-300 font-mono">
                {result.byTier ? `${result.byTier.unviewed || 0}/${result.byTier.followup || 0}/${result.byTier.final || 0}` : '—'}
              </p>
            </div>
          </div>
          {(result.remindersSent ?? 0) === 0 && (
            <p className="text-[10px] text-zinc-500 mt-2">
              All eligible reminders have already been sent. Sweep is idempotent — running again is safe.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 animate-scaleIn">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
