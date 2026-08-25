import Link from 'next/link';
import { db } from '@/lib/db';
import InvoiceTrackingPixel from '@/app/invoice/[id]/components/InvoiceTrackingPixel';
import {
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CreditCard,
  Lock,
  FileText,
  Clock,
  Building2,
  Hash,
  CalendarDays,
  Receipt,
  ArrowRight,
  XCircle,
  Search,
} from 'lucide-react';
import PayForm from './PayForm';
import CheckoutTimer from './CheckoutTimer';

// Never cache a checkout page — the invoice status can flip at any moment
// (paid / voided / refunded) and the customer must always see the truth.
export const dynamic = 'force-dynamic';
// Render on every request so the tracking pixel + amount reflect the DB.
export const revalidate = 0;

type PayPageProps = {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ error?: string }>;
};

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function PayPage({ params, searchParams }: PayPageProps) {
  const { uuid } = await params;
  const { error: errorParam } = await searchParams;

  // ── Safe DB lookup ──────────────────────────────────────────────
  let invoice: Awaited<ReturnType<typeof db.invoice.findUnique>> = null;
  let dbError = false;
  try {
    invoice = await db.invoice.findUnique({
      where: { id: uuid },
      include: { client: true, workspace: true },
    });
  } catch (err) {
    console.error('[pay/[uuid]] DB lookup failed:', err);
    dbError = true;
  }

  // ── DB blew up → graceful retry card (NOT a 500) ──────────────
  if (dbError) {
    return (
      <CheckoutShell>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Checkout is temporarily unavailable
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            We couldn&apos;t reach the payment database right now. Please try again in a moment —
            your invoice is safe.
          </p>
          <a
            href={`/pay/${uuid}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400"
          >
            <Loader2 className="h-4 w-4" />
            Retry checkout
          </a>
        </div>
      </CheckoutShell>
    );
  }

  // ── Invoice not found → honest "not found" card ────────────────
  if (!invoice) {
    return (
      <CheckoutShell>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <AlertTriangle className="h-6 w-6 text-zinc-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Not Found</h1>
          <p className="text-zinc-400 text-sm mb-6">
            This payment link may have expired or is invalid.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            ← Back to ThubPay
          </Link>
        </div>
      </CheckoutShell>
    );
  }

  const client = invoice.client;
  const workspace = invoice.workspace;
  const amount = invoice.totalCents;
  const currency = invoice.currency || 'usd';
  const isPaid = invoice.status === 'paid';
  const isVoided = invoice.status === 'void';
  const isOverdue =
    invoice.status === 'overdue' ||
    (!isPaid && !!invoice.dueDate && new Date(invoice.dueDate) < new Date());

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);

  const invoiceNumber = invoice.invoiceNumber || uuid.slice(0, 8);
  const brandName = workspace?.name || 'ThubPay Merchant';
  const brandLogo = workspace?.logoUrl;

  return (
    <CheckoutShell>
      {/* Tracking pixel — fires once per real browser render */}
      {invoice.trackingToken && <InvoiceTrackingPixel token={invoice.trackingToken} />}

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* ── Merchant header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-9 w-9 rounded-xl object-cover border border-emerald-500/20 shadow-md"
              />
            ) : (
              <img
                src="/icon.svg"
                alt="ThubPay"
                className="h-9 w-9 rounded-xl object-contain border border-[#00F5A0]/20 shadow-md"
              />
            )}
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{brandName}</p>
              <p className="text-[10px] text-zinc-500">Secure checkout</p>
            </div>
          </div>
          <CheckoutTimer dueDate={invoice.dueDate} createdAt={invoice.createdAt} />
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="px-6 py-6 space-y-6">
          {/* Status banner */}
          {isPaid && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-300">Payment already received</p>
                <p className="text-[11px] text-emerald-400/80">
                  This invoice was settled on {formatDate(invoice.paidAt)}. Thank you!
                </p>
              </div>
            </div>
          )}

          {isVoided && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-600/30 bg-zinc-700/10 p-4">
              <XCircle className="h-6 w-6 shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-bold text-zinc-300">This payment link is no longer active</p>
                <p className="text-[11px] text-zinc-500">
                  Please contact the merchant if you believe this is a mistake.
                </p>
              </div>
            </div>
          )}

          {isOverdue && !isPaid && !isVoided && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
              <Clock className="h-5 w-5 shrink-0 text-red-400" />
              <p className="text-xs font-medium text-red-300">
                This invoice is past due. Please pay as soon as possible to avoid late fees.
              </p>
            </div>
          )}

          {errorParam === 'voided' && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-600/30 bg-zinc-700/10 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-zinc-400" />
              <p className="text-xs text-zinc-400">
                This invoice was cancelled by the merchant and can no longer be paid.
              </p>
            </div>
          )}

          {/* ── Amount display ────────────────────────────────────── */}
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Amount due
            </p>
            <p
              className={`mt-1 text-5xl font-black tracking-tight ${
                isPaid
                  ? 'text-emerald-400'
                  : isVoided
                    ? 'text-zinc-500'
                    : 'bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent'
              }`}
            >
              {formattedAmount}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Invoice{' '}
              <span className="font-mono font-semibold text-zinc-300">#{invoiceNumber}</span>
            </p>
          </div>

          {/* ── Order summary ─────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 space-y-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <Receipt className="h-3 w-3" /> Order summary
            </p>
            <SummaryRow icon={Hash} label="Invoice number" value={invoiceNumber} mono />
            <SummaryRow
              icon={Building2}
              label="Billed to"
              value={client?.name || client?.email || 'Guest customer'}
            />
            {client?.company && (
              <SummaryRow icon={Building2} label="Company" value={client.company} />
            )}
            {invoice.dueDate && (
              <SummaryRow
                icon={CalendarDays}
                label="Due date"
                value={formatDate(invoice.dueDate)}
                warn={isOverdue}
              />
            )}
            <div className="my-1 border-t border-white/5" />
            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
                <CreditCard className="h-3.5 w-3.5 text-zinc-500" /> Total
              </span>
              <span className="text-base font-black text-white">{formattedAmount}</span>
            </div>
          </div>

          {/* ── Payment form / status ─────────────────────────────── */}
          {isPaid ? (
            <div className="space-y-3">
              <Link
                href={`/invoice/${invoice.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <FileText className="h-4 w-4" />
                View invoice & receipt
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : isVoided ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                ← Return to ThubPay
              </Link>
            </div>
          ) : (
            <PayForm
              invoiceId={invoice.id}
              formattedAmount={formattedAmount}
              defaultEmail={client?.email || ''}
              defaultName={client?.name || ''}
              errorParam={errorParam}
            />
          )}

          {/* ── Footer links ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/5 pt-4 text-[11px]">
            <Link
              href={`/invoice/${invoice.id}`}
              className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-emerald-400"
            >
              <FileText className="h-3 w-3" />
              Detailed invoice statement
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/pay/lookup"
              className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-emerald-400"
            >
              <Search className="h-3 w-3" />
              Find my receipts
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/terms-and-conditions"
              className="text-zinc-500 transition-colors hover:text-emerald-400"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>

      {/* ── Trust badges below the card ─────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-emerald-500/70" /> SSL encrypted
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-500/70" /> PCI DSS Level 1
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500/70" /> 3-D Secure
        </span>
        <span className="text-zinc-700">·</span>
        <span>Powered by ThubPay</span>
      </div>
    </CheckoutShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0b] px-4 py-10 sm:py-14">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60rem 40rem at 20% -10%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(50rem 40rem at 100% 100%, rgba(20,184,166,0.08), transparent 55%)',
        }}
      />
      {/* subtle grid */}
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
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
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

function SummaryRow({
  icon: Icon,
  label,
  value,
  mono,
  warn,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-1.5 text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span
        className={`truncate text-right ${mono ? 'font-mono' : ''} ${
          warn ? 'font-semibold text-red-300' : 'text-zinc-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
