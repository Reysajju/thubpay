import Link from 'next/link';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <nav className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">ThubPay</Link>
          <Link href="/dashboard" className="text-sm text-[#34D399]">Dashboard</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black mb-8">How It Works</h1>
        <div className="space-y-8">
          {[
            { step: '1', title: 'Create Your Account', desc: 'Sign up for free and your workspace is automatically created.' },
            { step: '2', title: 'Connect Your Gateway', desc: 'Add your Stripe, PayPal, or other payment gateway credentials securely. All keys are AES-256-GCM encrypted.' },
            { step: '3', title: 'Create Invoices & Payment Links', desc: 'Generate branded invoices and shareable payment links that route through your gateway.' },
            { step: '4', title: 'Get Paid', desc: 'Clients pay through your configured gateway. Track everything from your dashboard in real time.' },
          ].map((s) => (
            <div key={s.step} className="flex gap-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669] to-[#34D399] text-black font-black text-lg">{s.step}</div>
              <div>
                <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                <p className="text-zinc-400 mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/signup" className="rounded-xl bg-gradient-to-r from-[#059669] to-[#34D399] px-8 py-3 text-sm font-bold text-black">Get Started Free</Link>
        </div>
      </div>
    </div>
  );
}
