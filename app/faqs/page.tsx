import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'FAQs',
  description:
    'Frequently asked questions about ThubPay plans, limits, security, integrations, and migration.',
  keywords: ['payment portal FAQs', 'ThubPay FAQ', 'modern payment portal help']
};

const faqs = [
  ['What is ThubPay?', 'ThubPay is a modern payment portal for startups and scaling digital businesses.'],
  ['Is there a free plan?', 'Yes. The Free plan is free forever and includes industry-standard limits for early-stage teams.'],
  ['What does Premium cost?', 'Premium is $19.99 USD per month with no industry transaction limits.'],
  ['Is ThubPay secure?', 'Yes. We follow secure payment architecture patterns, gateway tokenization, and strict access controls.'],
  ['Which gateways are supported?', 'You can connect Stripe, PayPal, Square, Adyen, and additional providers as needed.']
];

export default function FaqPage() {
  return (
    <PageShell
      title="Frequently Asked Questions"
      subtitle="Direct answers optimized for users and answer engines."
    >
      {faqs.map(([q, a]) => (
        <div key={q} className="border-b border-thubpay-border pb-4">
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">{q}</h2>
          <p>{a}</p>
        </div>
      ))}
    </PageShell>
  );
}
