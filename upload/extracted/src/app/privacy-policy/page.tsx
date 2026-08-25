import Link from 'next/link';

export default function privacypolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <nav className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">ThubPay</Link>
          <Link href="/dashboard" className="text-sm text-[#34D399]">Dashboard</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black mb-8">rivacyolicy</h1>
        <p className="text-zinc-400">Content coming soon.</p>
      </div>
    </div>
  );
}
