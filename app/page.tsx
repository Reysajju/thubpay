import Hero from '@/components/ui/Hero/Hero';
import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ThubPay Payment Portal for Startups',
  description:
    'ThubPay payment portal: checkout, subscriptions, invoices, and workspace tools. Free plan plus Premium at $19.99/month.',
  keywords: [
    'ThubPay',
    'payment portal',
    'startup billing',
    'Stripe subscriptions',
    'invoicing',
    'payment links'
  ]
};

export default async function PricingPage() {
  const supabase = createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

  return (
    <>
      <Hero />
      <Pricing
        user={user}
        products={products ?? []}
        subscription={subscription}
      />
      <section className="bg-thubpay-surface border-t border-thubpay-border py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full min-w-0">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 text-center text-balance">
            Why startups choose this payment portal
          </h2>
          <p className="text-zinc-400 max-w-3xl mx-auto text-center mb-10 text-pretty">
            ThubPay combines startup-friendly pricing, modern payment portal
            architecture, and security-first engineering so teams can launch
            faster and scale with confidence.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              'Free forever plan for early-stage teams',
              'Premium plan at $19.99/month with no industry limits',
              'Invoices, payment links, brands, and client records in one workspace',
              'Dashboard analytics, exports, and team controls built for operators',
              'Stripe-backed checkout with secure defaults and webhook reliability',
              'Multi-gateway roadmap: one abstraction for how you get paid'
            ].map((item) => (
              <div key={item} className="glass-card rounded-xl p-5 text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
