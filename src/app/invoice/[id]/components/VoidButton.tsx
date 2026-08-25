'use client';

import { useState, useTransition } from 'react';
import { voidInvoice } from '@/app/dashboard/actions';
import {
  Ban,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

interface VoidButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  currentStatus: string;
}

export default function VoidButton({
  invoiceId,
  invoiceNumber,
  currentStatus,
}: VoidButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok?: boolean; success?: boolean; error?: string } | null
  >(null);

  // Already voided — no action needed.
  if (currentStatus === 'void') {
    return (
      <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700/50 bg-zinc-800/30 text-sm font-semibold text-zinc-500">
        <Ban className="w-4 h-4" />
        Invoice voided
      </div>
    );
  }

  function handleOpen() {
    setOpen(true);
    setResult(null);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      const res = await voidInvoice(invoiceId);
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700/50 text-sm font-semibold text-zinc-400 hover:border-red-500/40 hover:bg-red-500/5 hover:text-red-400 transition-all"
      >
        <Ban className="w-4 h-4" />
        Void invoice
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f11] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <Ban className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Void invoice</h2>
              <p className="text-[10px] text-zinc-500">{invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={pending}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {result?.success ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">Invoice voided</p>
            <p className="mt-1 text-xs text-zinc-400">
              The payment link is no longer active. The page will reload shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div className="text-[11px] leading-relaxed text-red-200/90">
                <p className="font-semibold text-red-200">This action cannot be undone.</p>
                <p className="mt-0.5">
                  Voiding will permanently cancel the payment link. The customer will see a
                  &ldquo;no longer active&rdquo; message if they try to pay.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Current status</span>
                <span className="font-semibold capitalize text-zinc-300">{currentStatus}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500">New status</span>
                <span className="font-semibold text-red-400">void</span>
              </div>
            </div>

            {result && !result.success && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-[11px] text-red-300">{result.error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition-all hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/40 transition-all hover:from-red-500 hover:to-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Voiding…
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Void invoice
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
