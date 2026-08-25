import Link from 'next/link';

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
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
