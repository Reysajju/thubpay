import type { Metadata, Viewport } from 'next';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { Toaster } from '@/components/ui/Toasts/toaster';
import { PropsWithChildren, Suspense } from 'react';
import { getURL } from '@/utils/helpers';
import 'styles/main.css';

const title = 'ThubPay — Bring Your Own Gateway. One Payment Dashboard.';
const description =
  'ThubPay lets startups connect any payment gateway — Stripe, PayPal, Square, Razorpay, and more — into one unified billing dashboard. Built for founders who want invoices, subscriptions, and real-time revenue analytics without vendor lock-in.';
const siteUrl = getURL();
const brandName = 'ThubPay';
const seoKeywords = [
  'payment gateway for startups',
  'bring your own payment gateway',
  'multi-gateway payment platform',
  'startup billing software',
  'invoice payment portal',
  'Stripe alternative',
  'payment dashboard for founders',
  'subscription billing startup',
  'white-label payment gateway',
  'online invoice software',
  'SaaS payment infrastructure',
  'recurring billing for startups',
  'ThubPay',
  'payment orchestration platform'
];

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111'
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | ThubPay'
  },
  description: description,
  keywords: seoKeywords,
  authors: [{ name: 'ThubPay' }],
  creator: 'ThubPay',
  publisher: 'ThubPay',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: title,
    description: description,
    siteName: 'ThubPay',
    type: 'website',
    url: siteUrl,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
    creator: '@ThubPay'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: brandName,
        url: siteUrl,
        logo: `${siteUrl}/icon.png`,
        sameAs: [
          'https://x.com/thubpay',
          'https://linkedin.com/company/thubpay',
          'https://github.com/thubpay'
        ]
      },
      {
        '@type': 'WebSite',
        name: `${brandName} Payment Portal`,
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/blogs?query={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'SoftwareApplication',
        name: `${brandName} Payment Portal`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: [
          {
            '@type': 'Offer',
            name: 'Free Plan',
            price: '0',
            priceCurrency: 'USD'
          },
          {
            '@type': 'Offer',
            name: 'Premium Plan',
            price: '19.99',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '19.99',
              priceCurrency: 'USD',
              billingDuration: 1,
              billingIncrement: 1,
              unitText: 'MONTH'
            }
          }
        ]
      }
    ]
  };

  return (
    <html lang="en">
    <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body className="bg-thubpay-obsidian text-zinc-100 overflow-x-hidden antialiased">
        <Navbar />
        <main
          id="skip"
          className="min-h-[calc(100dvh-4rem)] md:min-h-[calc(100dvh-5rem)] min-w-0"
        >
          {children}
        </main>
        <Footer />
        <Suspense>
          <Toaster />
        </Suspense>
      </body>
    </html>
  );
}
