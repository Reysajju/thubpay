import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd, getWebPageSchema } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'ThubPay — Multi-Gateway Payment Platform',
  description: 'Accept payments your way. Bring your own Stripe, PayPal, Square, or any gateway. Create invoices, send payment links, and manage your entire billing workflow from one dashboard.',
};

const features = [
  { title: 'Bring Your Own Gateway', desc: 'Connect Stripe, PayPal, Square, Razorpay, or any gateway. Your keys, your control, zero lock-in.', icon: 'shield' },
  { title: 'Smart Payment Links', desc: 'Generate shareable payment links that auto-route to your preferred gateway. One link, any payment method.', icon: 'link' },
  { title: 'Professional Invoicing', desc: 'Create branded invoices, send via email, track views and payments. Automatic overdue reminders.', icon: 'file' },
  { title: 'Multi-Gateway Routing', desc: 'Route payments through different gateways based on amount, currency, or risk level for maximum approval rates.', icon: 'route' },
  { title: 'Enterprise Security', desc: 'AES-256-GCM encryption for all credentials. Row-level security isolates every workspace.', icon: 'lock' },
  { title: 'Real-Time Analytics', desc: 'Track revenue, success rates, and gateway performance across all your payment channels in real time.', icon: 'chart' },
];

function FeatureIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactElement> = {
    shield: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    link: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" /></svg>,
    file: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    route: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>,
    lock: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
    chart: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  };
  return icons[type] || icons.shield;
}

const trustedBy = [
  { name: 'Stripe', width: 80 },
  { name: 'PayPal', width: 80 },
  { name: 'Square', width: 70 },
  { name: 'Razorpay', width: 90 },
  { name: 'Mollie', width: 60 },
  { name: 'Adyen', width: 60 },
];

export default function HomePage() {
  const homePageSchema = getWebPageSchema({
    title: 'ThubPay — Multi-Gateway Payment Platform for Modern Businesses',
    description:
      'Accept payments your way. Bring your own Stripe, PayPal, Square, or Razorpay. Create invoices, send payment links, and manage your entire billing workflow from one dashboard.',
    url: '/',
  });

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <JsonLd data={homePageSchema} />
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399]">
              <span className="text-sm font-black text-white">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight">ThubPay</span>
          </Link>
          <div className="hidden items-center gap-8 sm:flex">
            <Link href="/how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors">How it works</Link>
            <Link href="/faqs" className="text-sm text-zinc-400 hover:text-white transition-colors">FAQs</Link>
            <Link href="/blogs" className="text-sm text-zinc-400 hover:text-white transition-colors">Blogs</Link>
            <Link href="/dashboard" className="text-sm font-semibold text-[#059669] hover:text-[#34D399] transition-colors">Dashboard</Link>
            <Link href="/signin" className="rounded-lg border border-[#059669]/50 px-4 py-2 text-sm font-semibold text-[#34D399] hover:bg-[#059669]/10 transition-all">Sign in</Link>
            <Link href="/signup" className="rounded-lg bg-gradient-to-r from-[#059669] to-[#34D399] px-4 py-2 text-sm font-bold text-black hover:opacity-90 transition-all">Get Started</Link>
          </div>
          {/* Mobile menu button */}
          <MobileMenuButton />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#059669]/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#059669]/[0.03] rounded-full blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36 relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#059669]/30 bg-[#059669]/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-[#34D399]">Multi-Gateway Payment Platform</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl leading-[1.1]">
              Accept Payments
              <span className="block bg-gradient-to-r from-[#059669] via-[#34D399] to-[#10B981] bg-clip-text text-transparent mt-1">Your Way</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-400 max-w-2xl mx-auto">
              Bring your own Stripe, PayPal, Square, or any payment gateway. Create invoices,
              send payment links, and manage your entire billing workflow — all from one dashboard.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#059669] to-[#34D399] px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#059669]/25 hover:shadow-xl hover:shadow-[#059669]/30 hover:-translate-y-0.5 transition-all">
                Get Started Free
              </Link>
              <Link href="/how-it-works" className="w-full sm:w-auto rounded-xl border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
                See How It Works
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-600">No credit card required. Free plan available.</p>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="border-y border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-center text-xs font-bold text-zinc-600 uppercase tracking-widest mb-8">Integrates with your favorite gateways</p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {trustedBy.map(g => (
              <div key={g.name} className="text-zinc-600 hover:text-zinc-400 transition-colors font-bold text-sm tracking-wide uppercase">
                {g.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-black sm:text-4xl">Built for Scale, Designed for Simplicity</h2>
            <p className="mt-4 text-zinc-400">Everything you need to collect payments — no platform lock-in.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 hover:border-[#059669]/30 hover:bg-white/[0.04] transition-all duration-300">
                <div className="mb-4 w-12 h-12 rounded-xl bg-[#059669]/10 flex items-center justify-center text-[#34D399] group-hover:bg-[#059669]/20 transition-colors">
                  <FeatureIcon type={f.icon} />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="border-y border-white/5 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10+', label: 'Payment Gateways' },
              { value: '99.9%', label: 'Uptime SLA' },
              { value: '256-bit', label: 'AES Encryption' },
              { value: '24/7', label: 'Monitoring' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-[#059669] to-[#34D399] bg-clip-text text-transparent">{s.value}</p>
                <p className="text-sm text-zinc-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#059669]/5 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black sm:text-4xl">Ready to Start Collecting Payments?</h2>
            <p className="mt-4 text-zinc-400">Set up your workspace in under 2 minutes. Connect your gateway and start invoicing immediately.</p>
            <Link href="/signup" className="mt-8 inline-block rounded-xl bg-gradient-to-r from-[#059669] to-[#34D399] px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#059669]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399]">
                  <span className="text-xs font-black text-white">T</span>
                </div>
                <span className="text-lg font-bold">ThubPay</span>
              </Link>
              <p className="text-sm text-zinc-500 leading-relaxed">Multi-gateway payment platform. Accept payments your way.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Product</h4>
              <div className="space-y-3">
                <Link href="/how-it-works" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">How it Works</Link>
                <Link href="/faqs" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">FAQs</Link>
                <Link href="/blogs" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Blog</Link>
                <Link href="/security" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Security</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Company</h4>
              <div className="space-y-3">
                <Link href="/about-us" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">About</Link>
                <Link href="/contact-us" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Contact</Link>
                <Link href="/privacy-policy" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Privacy</Link>
                <Link href="/terms-and-conditions" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Terms</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Connect</h4>
              <div className="space-y-3">
                <a href="#" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Twitter / X</a>
                <a href="#" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">GitHub</a>
                <a href="#" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">LinkedIn</a>
                <a href="#" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Discord</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-600">&copy; {new Date().getFullYear()} ThubPay. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-zinc-500">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MobileMenuButton() {
  return (
    <div className="sm:hidden">
      <details className="relative">
        <summary className="list-none cursor-pointer p-2 -mr-2 rounded-lg hover:bg-white/5 transition-colors">
          <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </summary>
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#131316] border border-[#252529] rounded-2xl p-4 shadow-2xl z-50">
          <div className="space-y-1">
            <Link href="/how-it-works" className="block px-3 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">How it works</Link>
            <Link href="/faqs" className="block px-3 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">FAQs</Link>
            <Link href="/blogs" className="block px-3 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Blogs</Link>
            <div className="border-t border-[#252529] my-2" />
            <Link href="/dashboard" className="block px-3 py-2.5 text-sm font-semibold text-[#34D399] hover:bg-[#059669]/10 rounded-lg transition-colors">Dashboard</Link>
            <Link href="/signin" className="block px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Sign in</Link>
            <Link href="/signup" className="block px-3 py-2.5 text-sm font-bold text-black bg-gradient-to-r from-[#059669] to-[#34D399] rounded-lg text-center mt-2">Get Started</Link>
          </div>
        </div>
      </details>
    </div>
  );
}