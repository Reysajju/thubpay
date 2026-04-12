import Link from 'next/link';
import { Metadata } from 'next';
import PageShell from '@/components/ui/Marketing/PageShell';

export const metadata: Metadata = {
  title: 'Blogs',
  description:
    'Read ThubPay blogs on payment portal optimization, startup billing, checkout UX, and payment security best practices.',
  keywords: ['payment portal blog', 'startup payment guides', 'ThubPay blogs']
};

const posts = [
  {
    slug: '#',
    title: 'How to choose a payment portal for startups',
    excerpt: 'A practical checklist for startup teams choosing their first billing stack.'
  },
  {
    slug: '#',
    title: 'Modern payment portal architecture in 2026',
    excerpt: 'Security, reliability, and speed patterns that matter for scaling teams.'
  },
  {
    slug: '#',
    title: 'Free vs premium payment plans: when to upgrade',
    excerpt: 'Clear signs it is time to move from free forever to paid infrastructure.'
  }
];

export default function BlogsPage() {
  return (
    <PageShell
      title="ThubPay Blogs"
      subtitle="Actionable guides for payment portal strategy, conversion, security, and growth."
    >
      {posts.map((post) => (
        <article key={post.title} className="border border-thubpay-border rounded-xl p-5 bg-white/70">
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">{post.title}</h2>
          <p className="text-zinc-600 mb-3">{post.excerpt}</p>
          <Link href={post.slug} className="text-thubpay-violet font-medium">
            Read article
          </Link>
        </article>
      ))}
    </PageShell>
  );
}
