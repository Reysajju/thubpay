import Link from 'next/link';

const faqs = [
  { q: 'What is ThubPay?', a: 'ThubPay is a multi-gateway payment platform that lets you bring your own payment gateway (Stripe, PayPal, Square, etc.) and manage invoices, payment links, and analytics from one dashboard.' },
  { q: 'Do I need to add my own payment gateway?', a: 'Yes. ThubPay is built on the "Bring Your Own Gateway" model. You add your own Stripe, PayPal, or other gateway credentials securely in Settings. Your keys are AES-256-GCM encrypted.' },
  { q: 'Is my data secure?', a: 'Absolutely. All credentials are encrypted with AES-256-GCM. Every workspace is isolated with Row-Level Security (RLS) in our database. We never store plaintext secrets.' },
  { q: 'Can I use multiple gateways?', a: 'Yes! You can connect multiple gateways and even route payments through different gateways based on criteria like amount or currency.' },
  { q: 'How do payment links work?', a: 'Create a payment link from your dashboard, share it with your client, and they can pay using the gateway you configured. The link tracks views, uses, and expiration.' },
];

export default function FAQsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <nav className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">ThubPay</Link>
          <Link href="/dashboard" className="text-sm text-[#34D399]">Dashboard</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black mb-8">Frequently Asked Questions</h1>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
