'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const GATEWAYS = [
  {
    name: 'Stripe',
    color: '#635BFF',
    desc: 'Full subscription & one-time payment support'
  },
  {
    name: 'PayPal',
    color: '#003087',
    desc: 'Braintree hosted fields, PayPal wallet checkout'
  },
  {
    name: 'Square',
    color: '#3E4348',
    desc: 'Web Payments SDK with Apple/Google Pay'
  },
  {
    name: 'Adyen',
    color: '#0ABF53',
    desc: 'Enterprise-grade REST API adapter'
  },
  {
    name: 'Razorpay',
    color: '#3395FF',
    desc: 'India-first gateway with UPI & wallets'
  },
  {
    name: 'Authorize.net',
    color: '#E0A320',
    desc: 'Legacy gateway with full feature parity'
  }
];

const STATS = [
  { value: '6+', label: 'Payment Gateways' },
  { value: '99.99%', label: 'Uptime SLA' },
  { value: 'PCI DSS', label: 'SAQ A-EP Compliant' },
  { value: '<50ms', label: 'API Response Time' }
];

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty('--mouse-x', `${x}%`);
      hero.style.setProperty('--mouse-y', `${y}%`);
    };
    hero.addEventListener('mousemove', handleMouseMove);
    return () => hero.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-thubpay-obsidian bg-grid min-h-[min(92dvh,880px)] sm:min-h-[90vh] flex items-center"
        style={{ '--mouse-x': '50%', '--mouse-y': '50%' } as React.CSSProperties}
      >
        {/* Radial glow that follows cursor */}
        <div
            className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(197,160,89,0.14), transparent 50%)'
          }}
        />

        {/* Static glow orbs */}
        <div
          className="glow-orb w-96 h-96 -top-24 -left-24"
          style={{ background: 'rgba(197,160,89,0.22)' }}
        />
        <div
          className="glow-orb w-80 h-80 bottom-0 right-0"
          style={{ background: 'rgba(10,108,123,0.25)' }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24 text-center">
          {/* Badge */}
          <div className="mx-auto inline-flex max-w-full flex-wrap items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-1.5 rounded-full border border-thubpay-violet/30 bg-thubpay-violet/10 text-thubpay-violet text-xs sm:text-sm font-medium mb-6 sm:mb-8 animate-slide-up text-pretty">
            <span className="w-2 h-2 shrink-0 rounded-full bg-thubpay-cyan animate-pulse" />
            <span>Now supporting 6 payment gateways — and growing</span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl min-[380px]:text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.15] sm:leading-tight mb-5 sm:mb-6 animate-slide-up text-balance px-0.5">
            ThubPay: <span className="gradient-text">Modern Payment Portal</span>{' '}
            for Startups
          </h1>

          {/* Sub-copy */}
          <p className="max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-zinc-400 leading-relaxed mb-10 animate-slide-up text-pretty">
            Run subscriptions, one-time payments, and client billing from one ThubPay
            workspace. Built for operators who need clear money movement, audit-friendly
            records, and Stripe-backed checkout without stitching five tools together.
          </p>

          {/* CTA buttons */}
          <div className="flex w-full max-w-md mx-auto flex-col sm:max-w-none sm:mx-0 sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 animate-slide-up">
            <Link
              href="/signin/signup"
              id="hero-cta-primary"
              className="btn-gradient inline-flex justify-center px-6 sm:px-8 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-[#111] shadow-thubpay-violet hover:shadow-card-hover transition-all duration-300"
            >
              Start for Free →
            </Link>
            <Link
              href="/contact-us"
              id="hero-cta-contact"
              className="inline-flex justify-center px-6 sm:px-8 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-zinc-300 border border-zinc-600 hover:border-thubpay-gold hover:text-white transition-all duration-300"
            >
              Contact sales
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold gradient-text">
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GATEWAY GRID ─────────────────────────────────────────────── */}
      <section className="bg-thubpay-dark-2 border-t border-thubpay-border py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Every gateway. <span className="gradient-text">One abstraction.</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-pretty">
              Switch gateways or run multiple in parallel without touching your
              business logic. Our adapter pattern keeps everything clean.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GATEWAYS.map((gw) => (
              <div
                key={gw.name}
                className="glass-card rounded-xl p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 group cursor-default transition-all duration-300"
              >
                <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: gw.color }}
                  >
                    {gw.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white group-hover:text-thubpay-gold transition-colors">
                      {gw.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 text-pretty">{gw.desc}</p>
                  </div>
                </div>
                <span className="self-start sm:ml-auto sm:shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Ready
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY STRIP ───────────────────────────────────────────── */}
      <section className="bg-thubpay-surface border-t border-thubpay-border py-12 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔐',
                title: 'End-to-End Encryption',
                desc: 'PII encrypted at rest with pgcrypto via Supabase Vault. Keys never leave the KMS.'
              },
              {
                icon: '🛡️',
                title: 'PCI DSS SAQ A-EP',
                desc: 'Client-side tokenisation only. Raw card data never hits your server.'
              },
              {
                icon: '⚡',
                title: 'Webhook Idempotency',
                desc: 'Every webhook event is deduplicated and stored with full audit trail.'
              }
            ].map((item) => (
              <div key={item.title} className="flex gap-4 items-start">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
