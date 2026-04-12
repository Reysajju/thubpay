import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'Read the ThubPay security approach for startup payment portal infrastructure, encryption, and access control.',
  keywords: ['payment portal security', 'ThubPay security', 'secure startup billing']
};

export default function SecurityPage() {
  return (
    <PageShell
      title="Security at ThubPay"
      subtitle="Security-first engineering for payment portal workflows."
    >
      <p>Gateway tokenization and webhook verification protect your billing events.</p>
      <p>Role-based access controls and authenticated middleware secure account data.</p>
      <p>Deployment standards include strict headers, HTTPS-only transport, and environment isolation.</p>
    </PageShell>
  );
}
