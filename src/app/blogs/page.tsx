import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd, getWebPageSchema, getBreadcrumbSchema } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Blog — ThubPay Payment Insights',
  description:
    'Explore ThubPay articles and guides on payment gateway setup, invoicing automation, multi-gateway routing strategies, fintech trends, and subscription billing best practices.',
  alternates: {
    canonical: '/blogs',
  },
};

export default function BlogsPage() {
  const pageSchema = getWebPageSchema({
    title: 'ThubPay Blog — Payment Gateway Insights & Fintech Guides',
    description:
      'Articles and guides on payment gateway integrations, subscription billing, invoicing automation, and fintech best practices for modern businesses.',
    url: '/blogs',
    type: 'CollectionPage',
  });
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blogs' },
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
        <h1 className="text-4xl font-black mb-8">Blog</h1>
        <p className="text-zinc-400">Insights, guides, and updates from the ThubPay team. Content coming soon.</p>
      </div>
    </div>
  );
}

