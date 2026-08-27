'use client';

import { useState } from 'react';
import {
  Search,
  Mail,
  Hash,
  Loader2,
  Receipt,
  ArrowRight,
  Download,
  AlertCircle,
  Inbox,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface PublicReceipt {
  transactionId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  method: string;
  merchantName: string;
}

interface LookupResult {
  ok: boolean;
  receipts?: PublicReceipt[];
  count?: number;
  error?: string;
  retryAfter?: number;
}

type Mode = 'email' | 'txId';

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  card: 'Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

export default function LookupForm({
  initialEmail = '',
  initialTxId = '',
}: {
  initialEmail?: string;
  initialTxId?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialTxId ? 'txId' : 'email');
  const [email, setEmail] = useState(initialEmail);
  const [txId, setTxId] = useState(initialTxId);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [pending, setPending] = useState(false);

  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const txIdValid = !txId || /^[a-zA-Z0-9_-]{6,40}$/.test(txId);
  const showEmailError = touched && mode === 'email' && email.length > 0 && !emailValid;
  const showTxIdError = touched && mode === 'txId' && txId.length > 0 && !txIdValid;

  const inputValue = mode === 'email' ? email : txId;
  const inputValid = mode === 'email' ? emailValid : txIdValid;
  const blockedByError = (showEmailError || showTxIdError);

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setTouched(false);
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!inputValue || !inputValid) return;
    setPending(true);
    setResult(null);
    try {
      const payload =
        mode === 'email' ? { email } : { txId };
      const res = await fetch('/api/public/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as LookupResult;
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') || '0');
        setResult({
          ok: false,
          error: `Too many lookup attempts. Please try again in ${Math.max(1, Math.ceil(retryAfter / 60))} minute(s).`,
          retryAfter,
        });
      } else {
        setResult(data);
      }
    } catch {
      setResult({
        ok: false,
        error: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Mode toggle ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
        <button
          type="button"
          onClick={() => switchMode('email')}
          aria-pressed={mode === 'email'}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            mode === 'email'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          By email
        </button>
        <button
          type="button"
          onClick={() => switchMode('txId')}
          aria-pressed={mode === 'txId'}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            mode === 'txId'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Hash className="h-3.5 w-3.5" />
          By transaction ID
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="lookupInput"
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            {mode === 'email' ? (
              <>
                <Mail className="h-3 w-3" /> Email used at checkout
              </>
            ) : (
              <>
                <Hash className="h-3 w-3" /> Transaction ID
              </>
            )}
          </label>
          <div className="relative">
            {mode === 'email' ? (
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            ) : (
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            )}
            <input
              id="lookupInput"
              name={mode === 'email' ? 'email' : 'txId'}
              type={mode === 'email' ? 'email' : 'text'}
              value={inputValue}
              onChange={(e) =>
                mode === 'email' ? setEmail(e.target.value) : setTxId(e.target.value)
              }
              onBlur={() => setTouched(true)}
              autoComplete={mode === 'email' ? 'email' : 'off'}
              spellCheck={false}
              placeholder={mode === 'email' ? 'you@example.com' : 'cmt812aul000rv7zz...'}
              aria-invalid={showEmailError || showTxIdError}
              className={`w-full rounded-xl border bg-black/30 py-3 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 transition-colors focus:bg-black/40 focus:outline-none focus:ring-2 ${
                showEmailError || showTxIdError
                  ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20'
                  : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20'
              } ${mode === 'txId' ? 'font-mono' : ''}`}
            />
          </div>
          {showEmailError && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
              <AlertCircle className="h-3 w-3" /> Please enter a valid email address.
            </p>
          )}
          {showTxIdError && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
              <AlertCircle className="h-3 w-3" /> Transaction ID must be 6–40 letters, numbers, or hyphens.
            </p>
          )}
          {mode === 'txId' && (
            <p className="mt-1.5 text-[10px] text-zinc-600">
              Tip: the transaction ID is in your receipt email subject line, e.g.{' '}
              <span className="font-mono text-zinc-500">cmt812aul…</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending || !inputValue || !inputValid}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching receipts…
            </>
          ) : (
            <>
              <Search className="h-4 w-4 transition-transform group-hover:scale-110" />
              Find my receipt{mode === 'email' ? 's' : ''}
            </>
          )}
        </button>
      </form>

      {/* ── Results ───────────────────────────────────────────── */}
      {result && !result.ok && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-4 ${
            result.retryAfter
              ? 'border-amber-500/20 bg-amber-500/[0.05]'
              : 'border-red-500/20 bg-red-500/[0.05]'
          }`}
        >
          {result.retryAfter ? (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          )}
          <p
            className={`text-xs ${
              result.retryAfter ? 'text-amber-300' : 'text-red-300'
            }`}
          >
            {result.error}
          </p>
        </div>
      )}

      {result && result.ok && result.receipts && result.receipts.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-8 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm font-semibold text-zinc-300">No receipts found</p>
          <p className="mt-1 text-xs text-zinc-500">
            {mode === 'email' ? (
              <>
                We couldn&apos;t find any payments associated with{' '}
                <span className="font-mono text-zinc-400">{email}</span>. Double-check the
                email address and try again.
              </>
            ) : (
              <>
                We couldn&apos;t find a receipt for transaction ID{' '}
                <span className="font-mono text-zinc-400">{txId}</span>. Please verify the ID
                and try again.
              </>
            )}
          </p>
        </div>
      )}

      {result && result.ok && result.receipts && result.receipts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {result.count} {result.count === 1 ? 'receipt' : 'receipts'} found
            </p>
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <ShieldCheck className="h-3 w-3 text-emerald-500/70" /> Verified
            </span>
          </div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {result.receipts.map((r) => (
              <ReceiptCard key={r.transactionId} receipt={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: PublicReceipt }) {
  const [downloaded, setDownloaded] = useState(false);

  function handleDownload() {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  }

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-black/20 p-4 transition-all hover:border-white/15 hover:bg-black/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Receipt className="h-4 w-4 text-emerald-400" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {receipt.invoiceNumber || receipt.invoiceId.slice(0, 8)}
              </p>
              <p className="truncate text-[11px] text-zinc-500">{receipt.merchantName}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-emerald-400">
            {formatAmount(receipt.amountCents, receipt.currency)}
          </p>
          <p className="text-[10px] text-zinc-500">{formatDate(receipt.paidAt)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-zinc-400">
            {METHOD_LABELS[receipt.method] || receipt.method}
          </span>
          <span className="truncate font-mono">
            TX: {receipt.transactionId.slice(0, 12)}…
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={`/api/public/receipt/${receipt.transactionId}/pdf`}
            download
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 transition-all hover:border-white/20 hover:text-white"
            title="Download PDF receipt"
          >
            {downloaded ? <Check2 /> : <Download className="h-3 w-3" />}
            PDF
          </a>
          <a
            href={`/pay/receipt/${receipt.transactionId}`}
            className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 transition-all hover:bg-emerald-500/10"
          >
            View
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Check2() {
  return (
    <svg
      className="h-3 w-3 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
