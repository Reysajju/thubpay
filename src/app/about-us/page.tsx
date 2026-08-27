import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd, getWebPageSchema, getBreadcrumbSchema } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'About Us — ThubPay',
  description:
    'Learn about ThubPay — the Bring Your Own Gateway payment platform giving businesses full control over how they accept payments. No lock-in, maximum security.',
  alternates: {
    canonical: '/about-us',
  },
};

export default function AboutUsPage() {
  const aboutPageSchema = getWebPageSchema({
    title: 'About ThubPay — Multi-Gateway Payment Platform',
    description:
      'ThubPay gives businesses full control over their payment stack. Bring Stripe, PayPal, Square or any gateway and manage invoicing, analytics, and subscriptions from one platform.',
    url: '/about-us',
    type: 'AboutPage',
  });
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'About Us', url: '/about-us' },
  ]);
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <JsonLd data={aboutPageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <nav className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">ThubPay</Link>
          <Link href="/dashboard" className="text-sm text-[#34D399]">Dashboard</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black mb-8">About ThubPay</h1>
        <div className="space-y-6 text-zinc-400 leading-relaxed">
          <p>ThubPay is a multi-gateway payment platform that puts you in control. Unlike traditional payment processors that lock you into a single provider, ThubPay lets you bring your own gateway — whether it&apos;s Stripe, PayPal, Square, or any other supported provider.</p>
          <p>We believe businesses should have the freedom to choose how they accept payments. Our platform provides a unified dashboard for invoicing, payment links, analytics, and customer management — while your payment processing happens through the gateway you trust.</p>
          <p>Every credential you add is encrypted with AES-256-GCM encryption and isolated by workspace. Your data is yours, always.</p>
        </div>
      </div>
    </div>
  );
}

