'use client';

import { useRef, useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { setMonthlyTarget } from '../actions';

interface Props {
  open: boolean;
  onClose: () => void;
  currentValue?: number;
}

export default function SetTargetModal({ open, onClose, currentValue = 0 }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [targetUsd, setTargetUsd] = useState(String((currentValue / 100).toFixed(2)));

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await setMonthlyTarget(fd);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-thubpay-surface rounded-2xl shadow-2xl border border-thubpay-border overflow-hidden animate-slideUp">
        <div className="px-6 py-5 border-b border-thubpay-border bg-thubpay-elevated">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Set Monthly Target</h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">
              Target Revenue (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">$</span>
              <input
                name="target_usd"
                type="number"
                step="0.01"
                min="0"
                required
                value={targetUsd}
                onChange={(e) => setTargetUsd(e.target.value)}
                placeholder="10000.00"
                className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-thubpay-border bg-thubpay-elevated text-white focus:outline-none focus:ring-2 focus:ring-thubpay-gold/40 transition"
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              Note: Ensure you have added the `monthly_target_cents` BIGINT column to your `workspaces` table in Supabase.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-thubpay-border text-zinc-300 text-sm font-semibold hover:bg-thubpay-elevated transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl btn-gradient text-[#111] text-sm font-bold disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#111]" /> Saving...
                </>
              ) : (
                'Set Target Goal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
