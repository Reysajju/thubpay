import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How ThubPay Works',
  description:
    'ThubPay lets you bring your own payment gateway and run all your invoices, subscriptions, and revenue analytics from one secure dashboard. Here\'s how it works in four steps.',
  keywords: [
    'how payment gateway works',
    'startup billing workflow',
    'bring your own gateway setup',
    'ThubPay onboarding',
    'payment portal walkthrough'
  ]
};

const STEPS = [
  {
    number: '01',
    title: 'Create Your Workspace',
    description:
      'Sign up free and provision your ThubPay workspace in under 60 seconds. Add your brand identity — logo, gradient, and custom domain — so every invoice and payment page reflects your company, not ours.',
    detail: 'No credit card required. Free plan includes 1 brand and unlimited invoices.'
  },
  {
    number: '02',
    title: 'Connect Your Payment Gateways',
    description:
      'Head to Settings → Gateways and paste your existing API keys. ThubPay supports Stripe, PayPal, Square, Razorpay, Braintree, Adyen, and more. Your keys are encrypted with AES-256-GCM and never leave your workspace.',
    detail: 'Switch between gateways per invoice. No vendor lock-in — ever.'
  },
  {
    number: '03',
    title: 'Create & Send Invoices',
    description:
      'Generate professional invoices in seconds. Assign a gateway, attach a client, and send via email with one click. Clients receive a branded payment page hosted on ThubPay where they pay inline — they never leave your ecosystem.',
    detail: 'Supports one-time payments, recurring subscriptions, and manual offline completions.'
  },
  {
    number: '04',
    title: 'Track Revenue in Real Time',
    description:
      'Your dashboard shows MRR, gross volume, profit/loss, open disputes, and monthly goal progress all in one place. Set a monthly revenue target and watch the golden progress bar fill as payments come in.',
    detail: 'Export reports. Audit every transaction. Share workspace analytics with your team.'
  }
];

const FEATURES = [
  { icon: '🔐', label: 'AES-256-GCM Encryption' },
  { icon: '⚡', label: 'Inline Stripe Elements' },
  { icon: '📊', label: 'Real-time Analytics' },
  { icon: '🌍', label: '6+ Gateway Support' },
  { icon: '📩', label: 'Automated Invoice Emails' },
  { icon: '✅', label: 'Manual Completion Flow' }
];

export default function HowItWorksPage() {
  return (
    <div className="bg-thubpay-obsidian min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-grid pt-20 pb-16 sm:pt-28 sm:pb-24 border-b border-thubpay-border">
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-orb w-80 h-80 -top-20 -right-20" style={{ background: 'rgba(201,168,108,0.18)' }} />
          <div className="glow-orb w-60 h-60 bottom-0 left-0" style={{ background: 'rgba(139,107,46,0.15)' }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-thubpay-gold/30 bg-thubpay-gold/8 text-thubpay-gold text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-thubpay-gold animate-pulse" />
            Platform Walkthrough
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold text-white mb-5 leading-tight">
            How <span className="gradient-text">ThubPay</span> Works
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            From zero to fully operational payment infrastructure in four steps.
            Bring your own gateways — we handle the rest.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="space-y-20">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col md:flex-row gap-8 md:gap-16 items-start ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
            >
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl glass-card flex items-center justify-center">
                  <span className="gradient-text text-3xl font-bold font-cormorant">{step.number}</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{step.title}</h2>
                <p className="text-zinc-400 leading-relaxed mb-4 text-base sm:text-lg">{step.description}</p>
                <div className="inline-flex items-center gap-2 text-xs text-thubpay-gold bg-thubpay-gold/8 border border-thubpay-gold/20 px-3 py-1.5 rounded-full">
                  ✦ {step.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature chips */}
      <section className="border-t border-thubpay-border bg-thubpay-surface py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-10">Everything included, out of the box</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {FEATURES.map((f) => (
              <span key={f.label} className="glass-card inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-zinc-200">
                <span>{f.icon}</span> {f.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-zinc-400 mb-8">Join founders who run their entire billing from one ThubPay workspace.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signin/signup" className="btn-gradient inline-flex justify-center px-8 py-3.5 rounded-xl font-semibold text-[#111] shadow-lg">
              Start for Free →
            </Link>
            <Link href="/contact-us" className="inline-flex justify-center px-8 py-3.5 rounded-xl font-semibold text-zinc-300 border border-zinc-600 hover:border-thubpay-gold hover:text-white transition-all">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
