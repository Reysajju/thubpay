'use client';

import Button from '@/components/ui/Button';
import type { Tables } from '@/types_db';
import { getStripe } from '@/utils/stripe/client';
import { checkoutWithStripe } from '@/utils/stripe/server';
import { getErrorRedirect } from '@/utils/helpers';
import { User } from '@supabase/supabase-js';
import cn from 'classnames';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

type Subscription = Tables<'subscriptions'>;
type Product = Tables<'products'>;
type Price = Tables<'prices'>;
interface ProductWithPrices extends Product {
  prices: Price[];
}
interface PriceWithProduct extends Price {
  products: Product | null;
}
interface SubscriptionWithProduct extends Subscription {
  prices: PriceWithProduct | null;
}

interface Props {
  user: User | null | undefined;
  products: ProductWithPrices[];
  subscription: SubscriptionWithProduct | null;
}

type BillingInterval = 'lifetime' | 'year' | 'month';

// Feature lists per plan tier
const PLAN_FEATURES: Record<string, string[]> = {
  Free: [
    'Free forever plan',
    '1 active payment gateway',
    'Up to 100 successful transactions/month',
    'Basic analytics (30-day retention)',
    'Community and email support'
  ],
  Premium: [
    '$19.99 USD per month',
    'All gateways (6+)',
    'No industry transaction limits',
    'Priority support',
    'Advanced analytics and exports',
    'Multi-gateway routing',
    'Admin dashboard + MFA'
  ]
};

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-thubpay-gold flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function Pricing({ user, products, subscription }: Props) {
  const intervals = Array.from(
    new Set(
      products.flatMap((product) =>
        product?.prices?.map((price) => price?.interval)
      )
    )
  );
  const router = useRouter();
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('month');
  const [priceIdLoading, setPriceIdLoading] = useState<string>();
  const currentPath = usePathname();

  const handleStripeCheckout = async (price: Price) => {
    setPriceIdLoading(price.id);

    if (!user) {
      setPriceIdLoading(undefined);
      return router.push('/signin/signup');
    }

    const { errorRedirect, sessionId } = await checkoutWithStripe(
      price,
      currentPath
    );

    if (errorRedirect) {
      setPriceIdLoading(undefined);
      return router.push(errorRedirect);
    }

    if (!sessionId) {
      setPriceIdLoading(undefined);
      return router.push(
        getErrorRedirect(
          currentPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      );
    }

    const stripe = await getStripe();
    stripe?.redirectToCheckout({ sessionId });
    setPriceIdLoading(undefined);
  };

  if (!products.length) {
    return (
      <section className="bg-thubpay-dark min-h-[60vh] flex items-center justify-center">
        <div className="max-w-2xl px-6 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-thubpay-violet/10 border border-thubpay-violet/30 flex items-center justify-center text-3xl">
            💳
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            No plans configured yet
          </h2>
          <p className="text-zinc-400 mb-6">
            Create your subscription products in the{' '}
            <a
              className="text-thubpay-violet underline underline-offset-2 hover:text-thubpay-cyan transition-colors"
              href="https://dashboard.stripe.com/products"
              rel="noopener noreferrer"
              target="_blank"
            >
              Stripe Dashboard
            </a>
            , then run the fixtures script to sync them.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="overflow-x-hidden bg-thubpay-obsidian py-16 sm:py-24">
      <div className="max-w-6xl px-4 mx-auto sm:px-6 lg:px-8 w-full min-w-0">
        {/* Header */}
        <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-thubpay-border bg-thubpay-surface text-zinc-400 text-xs font-medium mb-5">
            ThubPay pricing for startups
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            Pricing Plans
          </h2>
          <p className="max-w-xl mx-auto text-zinc-400 text-base sm:text-lg">
            Start with the Free plan and upgrade to Premium at $19.99/month for
            unlimited scale.
          </p>

          {/* Billing toggle */}
          {(intervals.includes('month') || intervals.includes('year')) && (
            <div className="inline-flex flex-wrap items-center justify-center gap-1 mt-8 p-1 rounded-xl bg-thubpay-surface border border-thubpay-border max-w-full">
              {intervals.includes('month') && (
                <button
                  onClick={() => setBillingInterval('month')}
                  type="button"
                  id="billing-monthly"
                  className={cn(
                    'px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    billingInterval === 'month'
                      ? 'bg-thubpay-gold text-[#111] shadow-thubpay-violet'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  Monthly
                </button>
              )}
              {intervals.includes('year') && (
                <button
                  onClick={() => setBillingInterval('year')}
                  type="button"
                  id="billing-yearly"
                  className={cn(
                    'px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2',
                    billingInterval === 'year'
                      ? 'bg-thubpay-gold text-[#111] shadow-thubpay-violet'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  Yearly
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-thubpay-blue/25 text-thubpay-cyan">
                    −20%
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="flex flex-col items-stretch sm:flex-row sm:flex-wrap sm:justify-center gap-6 w-full">
          {products.map((product, idx) => {
            const price = product?.prices?.find(
              (price) => price.interval === billingInterval
            );
            if (!price) return null;

            const priceString = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: price.currency!,
              minimumFractionDigits: 0
            }).format((price?.unit_amount || 0) / 100);

            const isActive = subscription
              ? product.name === subscription?.prices?.products?.name
              : product.name === 'Free';

            const isFeatured = product.name === 'Premium';

            const features =
              PLAN_FEATURES[product.name ?? ''] ?? PLAN_FEATURES['Free'];

            return (
              <div
                key={product.id}
                className={cn(
                  'flex flex-col rounded-2xl w-full max-w-md mx-auto sm:mx-0 sm:flex-1 sm:basis-64 sm:max-w-sm min-w-0 transition-all duration-300',
                  'bg-thubpay-surface border',
                  isFeatured
                    ? 'pricing-featured sm:scale-[1.02]'
                    : 'border-thubpay-border hover:border-thubpay-border/80',
                  isActive && 'border-thubpay-violet'
                )}
              >
                {/* Featured badge */}
                {isFeatured && (
                  <div className="px-6 pt-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-thubpay-gradient text-[#111]">
                      ✦ Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  {/* Plan name */}
                  <h3 className="text-lg font-bold text-white mb-1">
                    {product.name}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-6">
                    {product.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-white">
                      {priceString}
                    </span>
                    <span className="text-zinc-500 text-sm ml-1">
                      /{billingInterval}
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <CheckIcon />
                        <span className="text-sm text-zinc-300">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    id={`plan-cta-${product.name?.toLowerCase()}`}
                    type="button"
                    disabled={priceIdLoading === price.id}
                    onClick={() => handleStripeCheckout(price)}
                    className={cn(
                      'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
                      isFeatured
                        ? 'btn-gradient text-[#111] hover:shadow-card-hover'
                        : 'border border-thubpay-border text-zinc-200 hover:border-thubpay-gold hover:bg-thubpay-gold/10',
                      priceIdLoading === price.id && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {priceIdLoading === price.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Processing…
                      </span>
                    ) : subscription ? (
                      'Manage Plan'
                    ) : (
                      'Get Started'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust strip */}
        <div className="mt-14 text-center">
          <p className="text-xs text-zinc-500">
            Free forever available · Premium $19.99/month · No hidden fees ·
            Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
