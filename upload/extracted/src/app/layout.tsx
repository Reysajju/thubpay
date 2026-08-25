import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import SessionProvider from '@/components/auth/SessionProvider';
import NavigationProgress from '@/components/NavigationProgress';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const siteUrl = process.env.NEXTAUTH_URL || 'https://thubpay.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ThubPay — Multi-Gateway Payment Platform for Modern Businesses',
    template: '%s | ThubPay',
  },
  description:
    'Accept payments your way. Connect Stripe, PayPal, Square, Razorpay, Adyen, or any gateway. Create invoices, send payment links, manage subscriptions, track disputes, and run your entire billing workflow from one powerful dashboard.',
  keywords: [
    'payment gateway',
    'payment platform',
    'Stripe integration',
    'PayPal integration',
    'invoicing software',
    'payment links',
    'fintech',
    'billing platform',
    'multi-gateway payments',
    'subscription billing',
    'payment processing',
    'merchant services',
    'online payments',
    'invoice management',
    'payment dashboard',
  ],
  authors: [{ name: 'ThubPay' }],
  creator: 'ThubPay',
  publisher: 'ThubPay',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ThubPay — Multi-Gateway Payment Platform',
    description:
      'Accept payments your way. Bring your own Stripe, PayPal, Square, or any gateway. Create invoices, send payment links, and manage your entire billing workflow from one dashboard.',
    url: siteUrl,
    siteName: 'ThubPay',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'ThubPay — Multi-Gateway Payment Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ThubPay — Multi-Gateway Payment Platform',
    description: 'Accept payments your way. One dashboard, any gateway. Create invoices, send payment links, and track revenue in real time.',
    images: ['/opengraph-image.png'],
    creator: '@thubpay',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  verification: {
    google: 'google-site-verification-token',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10B981' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
};

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ThubPay',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Multi-gateway payment platform for modern businesses. Connect Stripe, PayPal, Square, and more. Create invoices, manage subscriptions, and track payments.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '1247',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Theme flash prevention — runs before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('thubpay-theme');if(t==='light'){document.documentElement.classList.add('light-theme');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-[#0a0a0c] text-white antialiased`}>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
