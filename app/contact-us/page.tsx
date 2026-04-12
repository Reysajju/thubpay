import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact ThubPay for startup payment portal onboarding, migration support, and security-related questions.',
  keywords: ['contact ThubPay', 'payment portal support', 'startup billing support']
};

export default function ContactUsPage() {
  return (
    <PageShell
      title="Contact Us"
      subtitle="Talk to the ThubPay team about onboarding, pricing, migration, and security."
    >
      <p>Email: hello@thubpay.com</p>
      <p>Sales: sales@thubpay.com</p>
      <p>Security: security@thubpay.com</p>
    </PageShell>
  );
}
