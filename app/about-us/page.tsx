import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About ThubPay',
  description:
    'ThubPay is a proprietary multi-gateway payment management platform built for startup founders. We give teams the infrastructure to bring their own payment gateways, manage invoices, track revenue, and get paid — all from one secure workspace.',
  keywords: ['about ThubPay', 'payment platform for startups', 'multi-gateway billing', 'BYOG platform']
};

const VALUES = [
  {
    icon: '🔑',
    title: 'Bring Your Own Gateway',
    desc: 'We believe in vendor freedom. ThubPay is the first BYOG payment platform — connect any gateway you already use and keep your existing merchant accounts.'
  },
  {
    icon: '🔐',
    title: 'Security by Default',
    desc: 'Every API key stored in ThubPay is encrypted with AES-256-GCM. Every payment form is end-to-end safe. We treat your credentials and client data like our own.'
  },
  {
    icon: '⚡',
    title: 'Built for Speed',
    desc: 'Create an invoice, assign a gateway, send it, and get paid — in under 60 seconds. No configuration hell. No spreadsheets. Just revenue flow.'
  },
  {
    icon: '🌍',
    title: 'Global from Day One',
    desc: 'From Stripe in the US to Razorpay in India to PayPal globally — ThubPay supports the gateways your clients are in. Geography should never block payment.'
  }
];

export default function AboutPage() {
  return (
    <div className="bg-thubpay-obsidian min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-grid pt-20 pb-16 sm:pt-28 sm:pb-24 border-b border-thubpay-border">
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-orb w-96 h-96 -top-24 -right-24" style={{ background: 'rgba(201,168,108,0.16)' }} />
          <div className="glow-orb w-64 h-64 bottom-0 left-0" style={{ background: 'rgba(139,107,46,0.12)' }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-thubpay-gold/30 bg-thubpay-gold/8 text-thubpay-gold text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-thubpay-gold animate-pulse" />
            Our Story
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold text-white mb-5 leading-tight">
            The payment platform <br className="hidden sm:block" />
            <span className="gradient-text">built for founders</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            ThubPay exists because startups deserve payment infrastructure that doesn't
            force them into a single vendor's ecosystem.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="glass-card rounded-3xl p-8 sm:p-12 mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-thubpay-gold mb-4">Our Mission</p>
          <blockquote className="text-2xl sm:text-3xl font-semibold text-white leading-relaxed">
            "Give every startup founder the payment infrastructure that only enterprise companies used to afford — 
            without the contracts, the lock-in, or the complexity."
          </blockquote>
        </div>

        {/* Story */}
        <div className="prose-zinc max-w-none space-y-5 text-zinc-400 text-base sm:text-lg leading-relaxed">
          <p>
            ThubPay started as a vision: what if a single dashboard could replace the five different tools
            a founder uses to invoice clients, track subscriptions, handle disputes, and watch revenue roll in?
          </p>
          <p>
            Today, ThubPay is a proprietary, fully-owned payment management platform. We're not an open-source
            fork anymore — we've built something fundamentally new: a <strong className="text-white">Bring Your Own Gateway (BYOG)</strong> architecture
            where you paste your existing Stripe, PayPal, or Razorpay API keys and immediately unlock
            a dashboard-grade billing workspace.
          </p>
          <p>
            We believe payment should be a commodity layer that any founder can control, not a tax they pay
            to a single vendor for the privilege of accepting money.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-thubpay-border bg-thubpay-surface py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">What we stand for</h2>
            <p className="text-zinc-400">Four principles that drive every product decision we make.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="glass-card rounded-2xl p-6 sm:p-8">
                <span className="text-3xl mb-4 block">{v.icon}</span>
                <h3 className="text-lg font-bold text-white mb-2">{v.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-4">Join the BYOG movement</h2>
          <p className="text-zinc-400 mb-8">Start free. Bring your gateway. Get paid your way.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signin/signup" className="btn-gradient inline-flex justify-center px-8 py-3.5 rounded-xl font-semibold text-[#111]">
              Start for Free →
            </Link>
            <a href="mailto:support@thubpay.com" className="inline-flex justify-center px-8 py-3.5 rounded-xl font-semibold text-zinc-300 border border-zinc-600 hover:border-thubpay-gold hover:text-white transition-all">
              Contact us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
