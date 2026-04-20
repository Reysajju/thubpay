import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sitemap — ThubPay',
  description: 'A complete sitemap of all pages available on ThubPay, the multi-gateway payment management platform for startups.',
};

const SECTIONS = [
  {
    title: 'Marketing',
    links: [
      { label: 'Home', href: '/', desc: 'Platform overview and pricing' },
      { label: 'How It Works', href: '/how-it-works', desc: '4-step BYOG onboarding walkthrough' },
      { label: 'Pricing', href: '/#pricing', desc: 'Free and Premium plans' },
      { label: 'FAQs', href: '/faqs', desc: 'Common startup founder questions' },
      { label: 'About Us', href: '/about-us', desc: 'Our mission and values' },
      { label: 'Contact Us', href: '/contact-us', desc: 'Reach our support team' },
      { label: 'Blogs', href: '/blogs', desc: 'Articles on payment and startup growth' },
    ]
  },
  {
    title: 'Legal & Trust',
    links: [
      { label: 'Privacy Policy', href: '/privacy-policy', desc: 'How we handle your data' },
      { label: 'Terms & Conditions', href: '/terms-and-conditions', desc: 'Service agreement and usage terms' },
      { label: 'Security', href: '/security', desc: 'Our encryption and compliance approach' },
      { label: 'Sitemap', href: '/sitemap-page', desc: 'This page' },
    ]
  },
  {
    title: 'Platform',
    links: [
      { label: 'Dashboard', href: '/dashboard', desc: 'Your workspace overview and analytics' },
      { label: 'Sign In', href: '/signin', desc: 'Log into your workspace' },
      { label: 'Sign Up', href: '/signin/signup', desc: 'Create your free ThubPay account' },
      { label: 'Account Settings', href: '/account', desc: 'Profile and billing preferences' },
    ]
  },
  {
    title: 'Payment Pages',
    links: [
      { label: 'Pay Invoice', href: '/pay/[invoice-id]', desc: 'Public-facing invoice payment portal' },
      { label: 'Payment Success', href: '/pay/success', desc: 'Confirmation after successful payment' },
    ]
  }
];

export default function SitemapPage() {
  return (
    <div className="bg-thubpay-obsidian min-h-screen">
      <section className="relative overflow-hidden bg-grid pt-20 pb-16 sm:pt-28 sm:pb-20 border-b border-thubpay-border">
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            <span className="gradient-text">Site</span>map
          </h1>
          <p className="text-zinc-400">Every page available on ThubPay, organized by section.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid sm:grid-cols-2 gap-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="glass-card rounded-2xl p-6 sm:p-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-thubpay-gold mb-5">
                {section.title}
              </h2>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group flex items-start gap-3"
                    >
                      <span className="text-thubpay-gold/50 group-hover:text-thubpay-gold transition-colors mt-0.5 text-sm">→</span>
                      <div>
                        <span className="text-white font-medium text-sm group-hover:text-thubpay-gold transition-colors">
                          {link.label}
                        </span>
                        <p className="text-zinc-500 text-xs mt-0.5">{link.desc}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
