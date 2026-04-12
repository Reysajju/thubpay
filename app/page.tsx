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
    'ThubPay is a modern payment portal for startups with a free forever plan and premium scale at $19.99/month.',
  keywords: [
    'ThubPay',
    'payment portal',
    'payment portal for startups',
    'modern payment portal',
    'modren payment portal',
    'startup payments'
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
      <section className="bg-[#fffdf8] border-t border-thubpay-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4 text-center">
            Why startups choose this payment portal
          </h2>
          <p className="text-zinc-600 max-w-3xl mx-auto text-center mb-10">
            ThubPay combines startup-friendly pricing, modern payment portal
            architecture, and security-first engineering so teams can launch
            faster and scale with confidence.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              'Free forever plan for early-stage teams',
              'Premium plan at $19.99/month with no industry limits',
              'Answer-engine-optimized content and structure',
              'Bright luxury, cozy, sleek UI for better conversions',
              'Stripe and Supabase integration with secure defaults',
              'SEO-ready technical stack built for Vercel deployment'
            ].map((item) => (
              <div key={item} className="glass-card rounded-xl p-5 text-zinc-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
