import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd, getWebPageSchema, getBreadcrumbSchema } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Security — ThubPay Platform',
  description:
    'ThubPay uses AES-256-GCM encryption, workspace-level isolation, HMAC-SHA256 webhook signing, CSRF protection, and SLA monitoring to keep your payment data safe.',
  alternates: {
    canonical: '/security',
  },
};

export default function SecurityPage() {
  const pageSchema = getWebPageSchema({
    title: 'ThubPay Security — Enterprise-Grade Payment Data Protection',
    description:
      'All gateway credentials are encrypted at rest with AES-256-GCM. Workspace data is fully isolated. HMAC-SHA256 signed webhooks. Real-time SLA monitoring with auto-alerts.',
    url: '/security',
  });
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Security', url: '/security' },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <JsonLd data={pageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <nav className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">ThubPay</Link>
          <Link href="/dashboard" className="text-sm text-[#34D399]">Dashboard</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black mb-8">Security</h1>
        <div className="space-y-6 text-zinc-400 leading-relaxed">
          <p>ThubPay treats security as a first-class feature, not an afterthought. Every gateway credential you store is encrypted at rest using AES-256-GCM with a per-deployment key — we never store plaintext secrets.</p>
          <p>Each workspace is fully isolated. Your data cannot be accessed by another tenant, even in the event of an application-level bug. Webhooks are signed with HMAC-SHA256 so you can verify every delivery. CSRF protection guards all state-changing API routes.</p>
          <p>Our real-time SLA monitoring tracks endpoint health, latency, and uptime across all your webhook endpoints — with automatic alerts when thresholds are breached.</p>
        </div>
      </div>
    </div>
  );
}

