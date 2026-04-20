import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact ThubPay',
  description:
    'Get in touch with the ThubPay team. Email us at support@thubpay.com for billing, gateway, or account questions. We respond within 24 hours on business days.',
  keywords: ['contact ThubPay', 'ThubPay support', 'payment gateway help', 'startup billing support']
};

export default function ContactPage() {
  return (
    <div className="bg-thubpay-obsidian min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-grid pt-20 pb-16 sm:pt-28 sm:pb-20 border-b border-thubpay-border">
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-orb w-72 h-72 -top-12 -left-12" style={{ background: 'rgba(201,168,108,0.16)' }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-thubpay-gold/30 bg-thubpay-gold/8 text-thubpay-gold text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-thubpay-gold animate-pulse" />
            Get in Touch
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 leading-tight">
            We're here to <span className="gradient-text">help</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Questions about gateways, pricing, or your workspace? Our team responds
            within 24 hours on business days.
          </p>
        </div>
      </section>

      {/* Contact grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid md:grid-cols-2 gap-10">

          {/* Contact cards */}
          <div className="space-y-5">
            <div className="glass-card rounded-2xl p-6 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-thubpay-gold/10 border border-thubpay-gold/20 flex items-center justify-center shrink-0">
                <span className="text-lg">📧</span>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Customer Support</p>
                <p className="text-zinc-500 text-sm mb-2">For billing, invoice, and gateway issues</p>
                <a href="mailto:support@thubpay.com" className="text-thubpay-gold font-medium hover:underline text-sm">
                  support@thubpay.com
                </a>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-thubpay-gold/10 border border-thubpay-gold/20 flex items-center justify-center shrink-0">
                <span className="text-lg">💼</span>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Sales & Enterprise</p>
                <p className="text-zinc-500 text-sm mb-2">Custom plans, volume pricing, and onboarding</p>
                <a href="mailto:support@thubpay.com" className="text-thubpay-gold font-medium hover:underline text-sm">
                  support@thubpay.com
                </a>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-thubpay-gold/10 border border-thubpay-gold/20 flex items-center justify-center shrink-0">
                <span className="text-lg">🤖</span>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">AI Assistant</p>
                <p className="text-zinc-500 text-sm mb-2">Instant answers inside your dashboard</p>
                <p className="text-zinc-400 text-sm">
                  Use the AI chat widget in your ThubPay dashboard for instant platform guidance, powered by GLM-4 Flash.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-thubpay-gold/10 border border-thubpay-gold/20 flex items-center justify-center shrink-0">
                <span className="text-lg">⏱️</span>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Response Time</p>
                <p className="text-zinc-500 text-sm">We respond within 24 hours on business days (Mon–Fri).</p>
              </div>
            </div>
          </div>

          {/* Quick message form */}
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-6">Send a message</h2>
            <form action={`mailto:support@thubpay.com`} method="get" className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Your Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Jane Founder"
                  className="w-full px-4 py-2.5 bg-thubpay-obsidian border border-thubpay-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-thubpay-gold/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@yourcompany.com"
                  className="w-full px-4 py-2.5 bg-thubpay-obsidian border border-thubpay-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-thubpay-gold/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Subject</label>
                <input
                  type="text"
                  name="subject"
                  placeholder="Gateway setup / Billing question / Other"
                  className="w-full px-4 py-2.5 bg-thubpay-obsidian border border-thubpay-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-thubpay-gold/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Message</label>
                <textarea
                  name="body"
                  rows={5}
                  placeholder="Describe your question or issue in detail..."
                  className="w-full px-4 py-2.5 bg-thubpay-obsidian border border-thubpay-border rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-thubpay-gold/50 transition-colors text-sm resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full btn-gradient py-3 rounded-xl font-semibold text-[#111] text-sm"
              >
                Send Message
              </button>
              <p className="text-center text-xs text-zinc-600">
                Or email us directly at{' '}
                <a href="mailto:support@thubpay.com" className="text-thubpay-gold hover:underline">
                  support@thubpay.com
                </a>
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
