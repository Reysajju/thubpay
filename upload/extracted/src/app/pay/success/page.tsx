import Link from 'next/link';
import { db } from '@/lib/db';
import {
  CheckCircle2,
  Download,
  FileText,
  ArrowRight,
  ShieldCheck,
  Home,
  Mail,
  Calendar,
  CreditCard,
  Hash,
  Building2,
  Receipt,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import CopyButton from './CopyButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SuccessPageProps = {
  searchParams: Promise<{
    invoice?: string;
    method?: string;
    tx?: string;
    email?: string;
  }>;
};

function formatDateTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  card: 'Credit / Debit Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

export default async function PaymentSuccessPage({ searchParams }: SuccessPageProps) {
  const { invoice: invoiceId, method, tx, email } = await searchParams;

  // Try to load the full invoice so we can render a real receipt.
  let invoice: Awaited<ReturnType<typeof db.invoice.findUnique>> = null;
  let transaction: Awaited<ReturnType<typeof db.transaction.findUnique>> = null;
  let dbError = false;

  if (invoiceId) {
    try {
      invoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: { client: true, workspace: true },
      });
      if (tx) {
        transaction = await db.transaction.findUnique({ where: { id: tx } });
      }
      // If no explicit tx id, look up the latest succeeded one for this invoice.
      if (!transaction && invoice) {
        transaction = await db.transaction.findFirst({
          where: { invoiceId: invoice.id, status: 'succeeded' },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (err) {
      console.error('[pay/success] DB lookup failed:', err);
      dbError = true;
    }
  }

  // Fallback amount display if invoice couldn't be loaded.
  const amount = invoice?.totalCents ?? transaction?.amountCents ?? 0;
  const currency = invoice?.currency || transaction?.currency || 'USD';
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);

  const brandName = invoice?.workspace?.name || 'ThubPay Merchant';
  const brandLogo = invoice?.workspace?.logoUrl;
  const invoiceNumber = invoice?.invoiceNumber || (invoiceId ? invoiceId.slice(0, 8) : '—');
  const transactionId = transaction?.id || tx || '—';
  const paidAt = invoice?.paidAt || transaction?.createdAt || new Date();
  const methodLabel = METHOD_LABELS[method || transaction?.gatewaySlug || 'card'] || 'Card';
  const customerEmail = email || invoice?.client?.email || transaction?.customerEmail || '';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0b] px-4 py-10 sm:py-14">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(50rem 40rem at 50% -10%, rgba(16,185,129,0.16), transparent 60%), radial-gradient(60rem 50rem at 100% 100%, rgba(20,184,166,0.10), transparent 55%)',
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

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col justify-center">
        {/* ── Success hero ───────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Payment Successful!</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Your payment of{' '}
            <span className="font-bold text-emerald-400">{formattedAmount}</span> has been
            processed.
          </p>
        </div>

        {/* ── Receipt card ───────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-2xl backdrop-blur-xl">
          {/* Merchant header */}
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-2.5">
              {brandLogo ? (
                 
                <img src={brandLogo} alt={brandName} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399] shadow-lg shadow-emerald-950/30">
                  <span className="text-sm font-black text-white">T</span>
                </div>
              )}
              <div className="leading-tight">
                <p className="text-sm font-bold text-white">{brandName}</p>
                <p className="text-[10px] text-zinc-500">Payment receipt</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Paid
            </span>
          </div>

          {dbError ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-zinc-400">
                We couldn&apos;t load the full receipt details right now, but your payment was
                successfully processed.
              </p>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-5">
              {/* ── Amount ─────────────────────────────────────────── */}
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Amount paid
                </p>
                <p className="mt-1 text-4xl font-black tracking-tight text-emerald-400">
                  {formattedAmount}
                </p>
              </div>

              {/* ── Receipt details ────────────────────────────────── */}
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 space-y-2.5">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Receipt className="h-3 w-3" /> Receipt details
                </p>
                <ReceiptRow icon={Hash} label="Receipt / Invoice" value={invoiceNumber} mono />
                <ReceiptRow icon={FileText} label="Transaction ID" value={transactionId} mono />
                <ReceiptRow icon={Calendar} label="Date paid" value={formatDateTime(paidAt)} />
                <ReceiptRow icon={CreditCard} label="Payment method" value={methodLabel} />
                {customerEmail && (
                  <ReceiptRow icon={Mail} label="Receipt sent to" value={customerEmail} />
                )}
                {invoice?.client?.name && (
                  <ReceiptRow icon={Building2} label="Billed to" value={invoice.client.name} />
                )}
              </div>

              {/* ── Transaction ID copy row ───────────────────────── */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Transaction reference
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-300">{transactionId}</p>
                </div>
                <CopyButton text={transactionId} />
              </div>

              {/* ── Email confirmation note ─────────────────────────── */}
              {customerEmail && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-[11px] leading-relaxed text-emerald-200/80">
                    A receipt has been sent to{' '}
                    <span className="font-semibold text-emerald-300">{customerEmail}</span>. Please
                    check your inbox (and spam folder).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="space-y-2 border-t border-white/5 px-6 py-4">
            {invoice && transactionId && transactionId !== '—' && (
              <a
                href={`/api/public/receipt/${transactionId}/pdf`}
                download
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400"
              >
                <Download className="h-4 w-4" />
                Download receipt (PDF)
              </a>
            )}
            <div className="grid grid-cols-2 gap-2">
              {invoice ? (
                <Link
                  href={`/invoice/${invoice.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View invoice
                </Link>
              ) : (
                <Link
                  href="/"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <Home className="h-3.5 w-3.5" />
                  Home
                </Link>
              )}
              <Link
                href={`/pay/lookup${customerEmail ? `?email=${encodeURIComponent(customerEmail)}` : ''}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <Search className="h-3.5 w-3.5" />
                My receipts
              </Link>
            </div>
            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:text-emerald-400"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Done
            </Link>
          </div>
        </div>

        {/* ── Trust footer ──────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500/70" /> Secure payment
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500/70" /> Verified transaction
          </span>
          <span className="text-zinc-700">·</span>
          <span>Powered by ThubPay</span>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-1.5 text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={`truncate text-right ${mono ? 'font-mono' : ''} text-zinc-200`}>
        {value}
      </span>
    </div>
  );
}
