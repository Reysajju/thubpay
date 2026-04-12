import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Learn about ThubPay, a modern payment portal for startups focused on speed, security, and scalable billing.',
  keywords: ['ThubPay', 'payment portal', 'modern payment portal for startups']
};

export default function AboutUsPage() {
  return (
    <PageShell
      title="About ThubPay"
      subtitle="We are rebranding startup payments into a bright, luxury, cozy, and sleek payment portal experience."
    >
      <p>
        ThubPay helps founders launch monetization faster with a modern payment
        portal built for startup execution speed.
      </p>
      <p>
        We combine secure architecture, premium UX, and practical pricing:
        Free forever for early growth and Premium at $19.99/month for unlimited
        scale.
      </p>
    </PageShell>
  );
}
