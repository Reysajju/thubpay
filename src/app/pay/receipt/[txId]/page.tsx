import Link from 'next/link';
import { db } from '@/lib/db';
import {
  CheckCircle2,
  Download,
  FileText,
  ArrowRight,
  ShieldCheck,
  Home,
  Calendar,
  CreditCard,
  Hash,
  Building2,
  Receipt,
  AlertTriangle,
  Loader2,
  Mail,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import CopyButton from './CopyButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ReceiptPageProps = {
  params: Promise<{ txId: string }>;
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

export default async function ReceiptViewPage({ params }: ReceiptPageProps) {
  const { txId } = await params;

  // ── Safe DB lookup ──────────────────────────────────────────────
  // Use `any` here because the bare ReturnType doesn't know about
  // the include clause. (Build-time type drift fix; runtime is safe.)
  let tx: any = null;
  let dbError = false;
  try {
    tx = await db.transaction.findUnique({
      where: { id: txId },
      include: {
        invoice: {
          include: {
            client: true,
            workspace: { select: { name: true, logoUrl: true } },
          },
        },
      },
    });
  } catch (err) {
    console.error('[pay/receipt] DB lookup failed:', err);
    dbError = true;
  }

  // ── DB error → graceful retry card ─────────────────────────────
  if (dbError) {
    return (
      <ReceiptShell>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Receipt temporarily unavailable
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            We couldn&apos;t load this receipt right now. Please try again in a moment.
          </p>
          <a
            href={`/pay/receipt/${txId}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400"
          >
            <Loader2 className="h-4 w-4" />
            Reload receipt
          </a>
        </div>
      </ReceiptShell>
    );
  }

  // ── Not found / not succeeded → honest card ────────────────────
  if (!tx || tx.status !== 'succeeded' || !tx.invoice) {
    return (
      <ReceiptShell>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <AlertTriangle className="h-6 w-6 text-zinc-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Receipt Not Found</h1>
          <p className="text-zinc-400 text-sm mb-6">
            This receipt link may be invalid or the payment hasn&apos;t been completed yet.
          </p>
          <Link
            href="/pay/lookup"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Search2 /> Find your receipts
          </Link>
        </div>
      </ReceiptShell>
    );
  }

  const invoice = tx.invoice;
  const workspace = invoice.workspace;
  const amount = invoice.totalCents ?? tx.amountCents;
  const currency = (invoice.currency || tx.currency || 'USD').toUpperCase();
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
  const brandName = workspace?.name || 'ThubPay Merchant';
  const brandLogo = workspace?.logoUrl;
  const invoiceNumber = invoice.invoiceNumber || invoice.id.slice(0, 8);
  const transactionId = tx.id;
  const paidAt = invoice.paidAt || tx.createdAt;
  const methodLabel = METHOD_LABELS[tx.gatewaySlug || 'card'] || 'Credit / Debit Card';
  const customerEmail = tx.customerEmail || invoice.client?.email || '';
  const customerName = tx.customerName || invoice.client?.name || '';
  const shareUrl = `/pay/receipt/${tx.id}`;

  return (
    <ReceiptShell>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-2xl backdrop-blur-xl">
        {/* ── Merchant header ─────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-8 w-8 rounded-lg object-cover"
              />
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

        {/* ── Body ──────────────────────────────────────────────── */}
        <div className="px-6 py-6 space-y-6">
          {/* ── Success hero ────────────────────────────────────── */}
          <div className="text-center">
            <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500/10" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Payment Receipt
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              This payment was successfully processed on{' '}
              <span className="font-semibold text-zinc-300">{formatDateTime(paidAt)}</span>.
            </p>
          </div>

          {/* ── Amount ──────────────────────────────────────────── */}
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
            <DetailRow icon={Hash} label="Receipt / Invoice" value={invoiceNumber} mono />
            <DetailRow icon={FileText} label="Transaction ID" value={transactionId} mono />
            <DetailRow icon={Calendar} label="Date paid" value={formatDateTime(paidAt)} />
            <DetailRow icon={CreditCard} label="Payment method" value={methodLabel} />
            {customerName && (
              <DetailRow icon={Building2} label="Billed to" value={customerName} />
            )}
            {customerEmail && (
              <DetailRow icon={Mail} label="Receipt email" value={customerEmail} />
            )}
            <DetailRow icon={Building2} label="Paid to" value={brandName} />
          </div>

          {/* ── Transaction ID copy + share row ─────────────────── */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Shareable receipt link
              </p>
              <p className="truncate font-mono text-xs text-zinc-300">{shareUrl}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <CopyButton text={shareUrl} label="Copy link" icon="share" />
            </div>
          </div>

          {/* ── Transaction ID copy row ─────────────────────────── */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Transaction reference
              </p>
              <p className="truncate font-mono text-xs text-zinc-300">{transactionId}</p>
            </div>
            <CopyButton text={transactionId} />
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="space-y-2 border-t border-white/5 px-6 py-4">
          <a
            href={`/api/public/receipt/${transactionId}/pdf`}
            download
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400"
          >
            <Download className="h-4 w-4" />
            Download receipt (PDF)
          </a>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/invoice/${invoice.id}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
            >
              <FileText className="h-3.5 w-3.5" />
              View invoice
            </Link>
            <Link
              href="/pay/lookup"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
            >
              <Search2 />
              My receipts
            </Link>
          </div>
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:text-emerald-400"
          >
            <Home className="h-3.5 w-3.5" />
            Back to ThubPay
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
    </ReceiptShell>
  );
}

// ── Shell wrapper ────────────────────────────────────────────────────

function ReceiptShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0b] px-4 py-10 sm:py-14">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60rem 40rem at 20% -10%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(50rem 40rem at 100% 100%, rgba(20,184,166,0.08), transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(70% 60% at 50% 30%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(70% 60% at 50% 30%, black, transparent)',
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col justify-center">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-zinc-400 transition-colors hover:text-white"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399] shadow-lg shadow-emerald-950/40">
            <span className="text-xs font-black text-white">T</span>
          </div>
          <span className="text-lg font-bold text-white">ThubPay</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function DetailRow({
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

function Search2() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
