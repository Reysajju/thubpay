import Link from 'next/link';
import LookupForm from './LookupForm';
import { Search, ArrowLeft, ShieldCheck, Mail, FileText, Lock, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

type LookupPageProps = {
  searchParams: Promise<{ email?: string; txId?: string }>;
};

export default async function ReceiptLookupPage({ searchParams }: LookupPageProps) {
  const { email, txId } = await searchParams;

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

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        {/* Header */}
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-zinc-400 transition-colors hover:text-white"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399] shadow-lg shadow-emerald-950/40">
            <span className="text-xs font-black text-white">T</span>
          </div>
          <span className="text-lg font-bold text-white">ThubPay</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-2xl backdrop-blur-xl">
          {/* Card header */}
          <div className="border-b border-white/5 px-6 py-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <Search className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">Find your receipts</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Enter the email you used at checkout to view and download your payment receipts.
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <LookupForm initialEmail={email || ''} initialTxId={txId || ''} />
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-6 py-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-emerald-500/70" /> Private &amp; secure
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500/70" /> Only shows your payments
              </span>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <InfoChip icon={Mail} label="Enter email" />
          <InfoChip icon={FileText} label="View receipts" />
          <InfoChip icon={Download} label="Download PDF" />
        </div>

        <Link
          href="/"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-emerald-400"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to ThubPay
        </Link>
      </div>
    </div>
  );
}

function InfoChip({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3 text-center">
      <Icon className="h-4 w-4 text-emerald-400/80" />
      <span className="text-[10px] font-medium text-zinc-400">{label}</span>
    </div>
  );
}
