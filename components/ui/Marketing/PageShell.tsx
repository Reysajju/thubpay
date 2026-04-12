import Link from 'next/link';
import { PropsWithChildren } from 'react';

interface PageShellProps {
  title: string;
  subtitle: string;
}

export default function PageShell({
  title,
  subtitle,
  children
}: PropsWithChildren<PageShellProps>) {
  return (
    <section className="bg-[#fffdf8]">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 mb-3">
          ThubPay Payment Portal
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 mb-4">
          {title}
        </h1>
        <p className="text-zinc-600 text-lg mb-8">{subtitle}</p>
        <div className="glass-card rounded-2xl p-6 md:p-8 text-zinc-700 space-y-4">
          {children}
        </div>
        <div className="mt-8 flex gap-3 flex-wrap">
          <Link href="/#pricing" className="btn-gradient rounded-xl px-5 py-2.5 text-white font-medium">
            View pricing
          </Link>
          <Link
            href="/contact-us"
            className="rounded-xl px-5 py-2.5 border border-thubpay-border text-zinc-800 hover:border-thubpay-violet"
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
