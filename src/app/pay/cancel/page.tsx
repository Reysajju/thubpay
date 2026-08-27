import Link from 'next/link';
import { XCircle, RefreshCw, Mail, LifeBuoy, Home, FileText, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

type CancelPageProps = {
  searchParams: Promise<{ invoice?: string }>;
};

export default async function PaymentCancelPage({ searchParams }: CancelPageProps) {
  const { invoice: invoiceId } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0b] px-4 py-10 sm:py-14">
      {/* Ambient backdrop — amber/red tint for cancellation */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(50rem 40rem at 50% -10%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(60rem 50rem at 100% 100%, rgba(239,68,68,0.06), transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        {/* ── Cancel hero ───────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-amber-500/10" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/30 bg-amber-500/10">
              <XCircle className="h-10 w-10 text-amber-400" />
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Payment Cancelled</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Your payment was not completed. No charges have been made.
          </p>
        </div>

        {/* ── Card ──────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-2xl backdrop-blur-xl">
          {/* Merchant header */}
          <div className="flex items-center gap-2.5 border-b border-white/5 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399] shadow-lg shadow-emerald-950/30">
              <span className="text-sm font-black text-white">T</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">ThubPay</p>
              <p className="text-[10px] text-zinc-500">Checkout cancelled</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3.5">
              <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-[11px] leading-relaxed text-amber-200/80">
                <p className="font-semibold text-amber-200">Need help?</p>
                <p className="mt-0.5">
                  If you experienced an issue during checkout, please try again. If the problem
                  persists, contact the merchant directly.
                </p>
              </div>
            </div>

            {/* ── Actions ─────────────────────────────────────── */}
            <div className="space-y-2">
              {invoiceId && (
                <Link
                  href={`/pay/${invoiceId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try payment again
                </Link>
              )}
              <div className={`grid ${invoiceId ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {invoiceId && (
                  <Link
                    href={`/invoice/${invoiceId}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View invoice
                  </Link>
                )}
                <Link
                  href="/"
                  className={`flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06] ${
                    invoiceId ? '' : 'w-full'
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  Return home
                </Link>
              </div>
            </div>

            {/* ── Support contact ──────────────────────────────── */}
            <div className="border-t border-white/5 pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Support
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5">
                <Mail className="h-4 w-4 text-zinc-500" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-500">Email support</p>
                  <a
                    href="mailto:support@thubpay.com"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    support@thubpay.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Trust footer ────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500/70" /> No charges made
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-amber-500/70" /> Transaction voided
          </span>
          <span className="text-zinc-700">·</span>
          <span>Powered by ThubPay</span>
        </div>
      </div>
    </div>
  );
}
