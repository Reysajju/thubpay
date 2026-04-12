import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how the ThubPay payment portal works from setup to checkout to recurring billing management.',
  keywords: ['how payment portal works', 'startup billing workflow', 'ThubPay setup']
};

export default function HowItWorksPage() {
  return (
    <PageShell
      title="How ThubPay Works"
      subtitle="Three simple steps to launch your payment portal with startup speed."
    >
      <h2 className="text-lg font-semibold text-zinc-900">Step 1: Connect gateways</h2>
      <p>Attach Stripe and other providers in one dashboard.</p>
      <h2 className="text-lg font-semibold text-zinc-900">Step 2: Configure plans</h2>
      <p>Create Free and Premium plans with secure checkout flows.</p>
      <h2 className="text-lg font-semibold text-zinc-900">Step 3: Go live on Vercel</h2>
      <p>Deploy globally with optimized metadata, sitemap, and security headers.</p>
    </PageShell>
  );
}
