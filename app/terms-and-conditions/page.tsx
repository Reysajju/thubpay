import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description:
    'Read ThubPay terms and conditions for using the payment portal platform and subscription services.',
  keywords: ['ThubPay terms', 'payment portal terms and conditions']
};

export default function TermsPage() {
  return (
    <PageShell
      title="Terms and Conditions"
      subtitle="Terms governing your use of the ThubPay payment portal."
    >
      <p>By using ThubPay, you agree to lawful platform usage and account security responsibilities.</p>
      <p>Billing terms: Free plan is free forever; Premium is billed at $19.99/month unless updated with prior notice.</p>
      <p>Service availability, support scope, and acceptable use are subject to these terms.</p>
    </PageShell>
  );
}
