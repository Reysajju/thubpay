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
    <section className="bg-thubpay-obsidian">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.18em] text-thubpay-gold/90 mb-3">
          ThubPay Payment Portal
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 text-balance">
          {title}
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg mb-8 text-pretty">
          {subtitle}
        </p>
        <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 text-zinc-300 space-y-4">
          {children}
        </div>
        <div className="mt-8 flex gap-3 flex-wrap">
          <Link href="/#pricing" className="btn-gradient rounded-xl px-5 py-2.5 text-[#111] font-medium">
            View pricing
          </Link>
          <Link
            href="/contact-us"
            className="rounded-xl px-5 py-2.5 border border-thubpay-border text-zinc-200 hover:border-thubpay-gold hover:text-white"
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
