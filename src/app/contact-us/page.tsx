import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd, getWebPageSchema, getBreadcrumbSchema } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Contact Us — ThubPay Support',
  description:
    'Get in touch with the ThubPay team. We offer support for payment gateway integrations, billing questions, and enterprise partnership inquiries.',
  alternates: {
    canonical: '/contact-us',
  },
};

export default function ContactUsPage() {
  const contactPageSchema = getWebPageSchema({
    title: 'Contact ThubPay — Support & Sales',
    description:
      'Reach out to ThubPay support for help with gateway integrations, billing, or enterprise inquiries.',
    url: '/contact-us',
    type: 'ContactPage',
  });
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Contact Us', url: '/contact-us' },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <JsonLd data={contactPageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <nav className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">ThubPay</Link>
          <Link href="/dashboard" className="text-sm text-[#34D399]">Dashboard</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black mb-8">Contact Us</h1>
        <div className="space-y-6 text-zinc-400">
          <p>Have questions about ThubPay? We&apos;d love to hear from you.</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-4">
            <p><span className="text-white font-semibold">Email:</span> support@thubpay.com</p>
            <p><span className="text-white font-semibold">Sales:</span> sales@thubpay.com</p>
            <p><span className="text-white font-semibold">Website:</span> thubpay.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

