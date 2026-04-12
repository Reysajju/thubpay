import { Metadata } from 'next';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { Toaster } from '@/components/ui/Toasts/toaster';
import { PropsWithChildren, Suspense } from 'react';
import { getURL } from '@/utils/helpers';
import 'styles/main.css';

const title = 'ThubPay - Modern Payment Portal for Startups';
const description =
  'ThubPay is a modern payment portal for startups. Launch secure checkout, subscriptions, and global payments with a bright, premium, answer-engine-optimized platform.';
const siteUrl = getURL();
const brandName = 'ThubPay';
const seoKeywords = [
  'ThubPay',
  'payment portal',
  'payment portal for startups',
  'modern payment portal',
  'modern payment portal for startups',
  'modren payment portal',
  'modren payment portal for startups',
  'startup billing platform',
  'SaaS payment portal',
  'secure payment portal'
];

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
        <meta name="theme-color" content="#f7f4ef" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body className="bg-[#f7f4ef] text-[#1d1b24]">
        <Navbar />
        <main
          id="skip"
          className="min-h-[calc(100dvh-4rem)] md:min-h[calc(100dvh-5rem)]"
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
