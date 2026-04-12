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
        className="relative overflow-hidden bg-[#f7f4ef] bg-grid min-h-[90vh] flex items-center"
        style={{ '--mouse-x': '50%', '--mouse-y': '50%' } as React.CSSProperties}
      >
        {/* Radial glow that follows cursor */}
        <div
            className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(108,92,231,0.12), transparent 50%)'
          }}
        />

        {/* Static glow orbs */}
        <div
          className="glow-orb w-96 h-96 -top-24 -left-24"
          style={{ background: 'rgba(108,92,231,0.25)' }}
        />
        <div
          className="glow-orb w-80 h-80 bottom-0 right-0"
          style={{ background: 'rgba(0,180,216,0.2)' }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-thubpay-violet/30 bg-thubpay-violet/10 text-thubpay-violet text-sm font-medium mb-8 animate-slide-up">
            <span className="w-2 h-2 rounded-full bg-thubpay-cyan animate-pulse" />
            Now supporting 6 payment gateways — and growing
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900 leading-tight mb-6 animate-slide-up">
            ThubPay: <span className="gradient-text">Modern Payment Portal</span>{' '}
            for Startups
          </h1>

          {/* Sub-copy */}
          <p className="max-w-3xl mx-auto text-lg md:text-xl text-zinc-600 leading-relaxed mb-10 animate-slide-up">
            Build with a payment portal for startups that feels bright, luxury,
            and cozy while staying enterprise-secure. ThubPay is your modern
            payment portal for subscriptions, one-time payments, and global
            checkout orchestration.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up">
            <Link
              href="/signin/signup"
              id="hero-cta-primary"
              className="btn-gradient px-8 py-3.5 rounded-xl text-base font-semibold text-white shadow-thubpay-violet hover:shadow-card-hover transition-all duration-300"
            >
              Start for Free →
            </Link>
            <Link
              href="/docs"
              id="hero-cta-docs"
              className="px-8 py-3.5 rounded-xl text-base font-semibold text-zinc-700 border border-thubpay-border hover:border-thubpay-violet hover:text-zinc-900 transition-all duration-300"
            >
              View Docs
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold gradient-text">
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-600 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GATEWAY GRID ─────────────────────────────────────────────── */}
      <section className="bg-[#fffaf1] border-t border-thubpay-border py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
              Every gateway. <span className="gradient-text">One abstraction.</span>
            </h2>
            <p className="text-zinc-600 max-w-xl mx-auto">
              Switch gateways or run multiple in parallel without touching your
              business logic. Our adapter pattern keeps everything clean.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GATEWAYS.map((gw) => (
              <div
                key={gw.name}
                className="glass-card rounded-xl p-5 flex items-start gap-4 group cursor-default transition-all duration-300"
              >
                {/* Colour dot */}
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: gw.color }}
                >
                  {gw.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 group-hover:text-thubpay-cyan transition-colors">
                    {gw.name}
                  </h3>
                  <p className="text-xs text-zinc-600 mt-0.5">{gw.desc}</p>
                </div>
                {/* Ready badge */}
                <span className="ml-auto flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Ready
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY STRIP ───────────────────────────────────────────── */}
      <section className="bg-[#fffdf8] border-t border-thubpay-border py-14">
        <div className="max-w-7xl mx-auto px-6">
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
                  <h3 className="font-semibold text-zinc-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">
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
