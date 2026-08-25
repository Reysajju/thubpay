import Link from 'next/link';

export default function ContactUsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
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
            <p><span className="text-white font-semibold">Website:</span> thubpay.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
