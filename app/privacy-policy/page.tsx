import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Understand how ThubPay collects, processes, and protects data across the payment portal.',
  keywords: ['ThubPay privacy policy', 'payment portal privacy']
};

export default function PrivacyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="How we handle your data in our modern payment portal for startups."
    >
      <p>We collect only the data needed to deliver billing, account, and support functionality.</p>
      <p>Payment card information is handled by connected payment gateways and tokenized securely.</p>
      <p>You may request access, correction, or deletion of personal data by contacting privacy@thubpay.com.</p>
    </PageShell>
  );
}
