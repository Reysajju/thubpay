'use client';

import { useState, useTransition } from 'react';
import { processRefund } from '@/app/dashboard/actions';
import {
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  DollarSign,
  MessageSquare,
} from 'lucide-react';

interface RefundModalProps {
  invoiceId: string;
  transactionId: string;
  amountCents: number;
  currency: string;
  invoiceNumber: string;
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const REASON_PRESETS = [
  'Customer request',
  'Duplicate payment',
  'Service not delivered',
  'Order cancelled',
  'Incorrect amount',
  'Other',
];

export default function RefundModal({
  invoiceId,
  transactionId,
  amountCents,
  currency,
  invoiceNumber,
}: RefundModalProps) {
  const [open, setOpen] = useState(false);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState('');
  const [result, setResult] = useState<
    { ok?: boolean; success?: boolean; error?: string; refundId?: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  const parsedPartial = Number(partialAmount || 0);
  const partialCents = Math.round(parsedPartial * 100);
  const refundCents = refundType === 'full' ? amountCents : partialCents;
  const isValid =
    refundType === 'full'
      ? true
      : Number.isFinite(parsedPartial) && parsedPartial > 0 && partialCents <= amountCents;

  function handleOpen() {
    setOpen(true);
    setResult(null);
    setRefundType('full');
    setPartialAmount('');
    setReason(REASON_PRESETS[0]);
    setCustomReason('');
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || pending) return;
    const finalReason = reason === 'Other' ? customReason.trim() || 'Other' : reason;
    setResult(null);
    startTransition(async () => {
      const res = await processRefund(transactionId, refundCents, finalReason);
      setResult(res);
      if (res.success) {
        // Reload after a short delay so the user sees the success state.
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all"
      >
        <RotateCcw className="w-4 h-4" />
        Refund payment
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
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f11] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <RotateCcw className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Process refund</h2>
              <p className="text-[10px] text-zinc-500">Invoice {invoiceNumber}</p>
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
            <p className="text-sm font-bold text-white">Refund processed successfully</p>
            <p className="mt-1 text-xs text-zinc-400">
              {formatAmount(refundCents, currency)} has been refunded. The invoice status
              will update shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Amount summary */}
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Original payment
                </span>
                <span className="text-sm font-bold text-white">
                  {formatAmount(amountCents, currency)}
                </span>
              </div>
            </div>

            {/* Refund type */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Refund amount
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundType('full')}
                  aria-pressed={refundType === 'full'}
                  className={`flex flex-col items-start rounded-xl border px-3.5 py-3 text-left transition-all ${
                    refundType === 'full'
                      ? 'border-amber-500/60 bg-amber-500/[0.07]'
                      : 'border-white/10 bg-black/20 hover:border-white/20'
                  }`}
                >
                  <span className="text-sm font-semibold text-white">Full refund</span>
                  <span className="text-[11px] text-zinc-500">
                    {formatAmount(amountCents, currency)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType('partial')}
                  aria-pressed={refundType === 'partial'}
                  className={`flex flex-col items-start rounded-xl border px-3.5 py-3 text-left transition-all ${
                    refundType === 'partial'
                      ? 'border-amber-500/60 bg-amber-500/[0.07]'
                      : 'border-white/10 bg-black/20 hover:border-white/20'
                  }`}
                >
                  <span className="text-sm font-semibold text-white">Partial</span>
                  <span className="text-[11px] text-zinc-500">Custom amount</span>
                </button>
              </div>
            </div>

            {/* Partial amount input */}
            {refundType === 'partial' && (
              <div>
                <label
                  htmlFor="partialAmount"
                  className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
                >
                  <DollarSign className="h-3 w-3" /> Amount to refund ({currency.toUpperCase()})
                </label>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <input
                    id="partialAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(amountCents / 100).toFixed(2)}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                    aria-invalid={!isValid && partialAmount.length > 0}
                    className={`w-full rounded-xl border bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 transition-colors focus:outline-none focus:ring-2 ${
                      !isValid && partialAmount.length > 0
                        ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20'
                        : 'border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20'
                    }`}
                  />
                </div>
                {!isValid && partialAmount.length > 0 && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
                    <AlertTriangle className="h-3 w-3" /> Amount must be between $0.01 and{' '}
                    {formatAmount(amountCents, currency)}.
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label
                htmlFor="refundReason"
                className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
              >
                <MessageSquare className="h-3 w-3" /> Reason
              </label>
              <select
                id="refundReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white transition-colors focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {REASON_PRESETS.map((r) => (
                  <option key={r} value={r} className="bg-[#0f0f11]">
                    {r}
                  </option>
                ))}
              </select>
              {reason === 'Other' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe the reason…"
                  maxLength={200}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              )}
            </div>

            {/* Refund summary */}
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-amber-300/80">
                  Refund total
                </span>
                <span className="text-lg font-black text-amber-300">
                  {formatAmount(refundCents, currency)}
                </span>
              </div>
            </div>

            {/* Error */}
            {result && !result.ok && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-[11px] text-red-300">{result.error}</p>
              </div>
            )}

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-[10px] leading-relaxed text-zinc-400">
                {refundType === 'full'
                  ? 'A full refund will return the entire amount to the customer and mark this invoice as unpaid. This action cannot be undone.'
                  : 'A partial refund will return the specified amount. The invoice will remain marked as paid.'}
              </p>
            </div>

            {/* Actions */}
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
                disabled={pending || !isValid}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-950/40 transition-all hover:from-amber-500 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Refund {formatAmount(refundCents, currency)}
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
