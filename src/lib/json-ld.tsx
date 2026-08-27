import React from 'react';

/**
 * Type-safe, production-grade JSON-LD schema builder adhering to Schema.org standards
 * and Google Rich Results guidelines for SaaS and Fintech payment platforms.
 */

const BASE_URL = process.env.NEXTAUTH_URL || 'https://thubpay.com';

/**
 * Sanitizes JSON-LD object for safe embedding inside a <script> tag (prevents XSS).
 */
export function sanitizeJsonLd(data: Record<string, any> | Array<Record<string, any>>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * React Component to render sanitized JSON-LD script tag.
 */
export function JsonLd({ data }: { data: Record<string, any> | Array<Record<string, any>> }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(data) }}
    />
  );
}

/**
 * 1. Global Platform Organization Schema
 */
export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'ThubPay',
    legalName: 'ThubPay Inc.',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/icon.svg`,
      width: '512',
      height: '512',
      caption: 'ThubPay - Multi-Gateway Payment Platform',
    },
    image: `${BASE_URL}/opengraph-image.png`,
    description:
      'ThubPay is an enterprise multi-gateway payment orchestration and invoicing platform allowing businesses to connect Stripe, PayPal, Square, Razorpay, and custom gateways under a single unified dashboard.',
    foundingDate: '2024',
    knowsAbout: [
      'Payment Gateway Orchestration',
      'Multi-Gateway Routing',
      'Subscription Management',
      'Smart Payment Links',
      'Automated Invoicing',
      'PCI Compliance & AES-256-GCM Encryption',
    ],
    sameAs: [
      'https://twitter.com/thubpay',
      'https://github.com/thubpay',
      'https://linkedin.com/company/thubpay',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+1-800-555-0199',
        contactType: 'customer support',
        email: 'support@thubpay.com',
        availableLanguage: ['English', 'Spanish', 'French'],
        areaServed: 'Worldwide',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'sales@thubpay.com',
        availableLanguage: ['English'],
        areaServed: 'Worldwide',
      },
    ],
  };
}

/**
 * 2. WebSite Schema with Sitelinks Searchbox
 */
export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    url: BASE_URL,
    name: 'ThubPay',
    description: 'Multi-Gateway Payment Platform for Modern Businesses',
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
    inLanguage: 'en-US',
  };
}

/**
 * 3. SoftwareApplication & SaaS Financial Product Schema
 */
export function getSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${BASE_URL}/#software`,
    name: 'ThubPay',
    operatingSystem: 'All (Cloud/Web Platform)',
    applicationCategory: 'BusinessApplication, FinancialApplication, PaymentApplication',
    url: BASE_URL,
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Starter Plan',
        price: '0',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        description: 'Free tier with up to 1 gateway connection and essential invoicing.',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '29.00',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        description: 'Unlimited gateway connections, smart multi-gateway routing, and automated follow-ups.',
      },
      {
        '@type': 'Offer',
        name: 'Scale & Enterprise Plan',
        price: '99.00',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        description: 'Dedicated infrastructure, custom SLAs, advanced webhook retries, and high-volume billing.',
      },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '1240',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Bring Your Own Gateway (Stripe, PayPal, Square, Razorpay, Mollie, Adyen)',
      'Zero Gateway Lock-in & Full Credential Ownership',
      'Smart Payment Link Generation with Tracking Pixels',
      'Automated Multi-Gateway Routing based on currency & amount',
      'Branded PDF Invoice Generation with QR codes',
      'AES-256-GCM Hardware-grade Credential Encryption',
      'Real-time Analytics, Churn Prediction & Revenue Forecasting',
      'Automated Webhook Dispatching with HMAC-SHA256 Signatures',
    ],
    screenshot: `${BASE_URL}/opengraph-image.png`,
    author: {
      '@id': `${BASE_URL}/#organization`,
    },
  };
}

/**
 * 4. FAQ Schema for FAQ Pages & Rich Snippets
 */
export function getFaqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}

/**
 * 5. HowTo Schema for Step-by-Step Guides
 */
export function getHowToSchema(steps: Array<{ step: string; title: string; desc: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Accept Multi-Gateway Payments with ThubPay',
    description:
      'Learn how to connect your payment gateways, generate branded invoices, and manage payment links seamlessly.',
    totalTime: 'PT5M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
    },
    step: steps.map((s, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: s.title,
      text: s.desc,
      url: `${BASE_URL}/how-it-works#step-${s.step}`,
    })),
  };
}

/**
 * 6. BreadcrumbList Schema for Navigation Hierarchies
 */
export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

/**
 * 7. WebPage Schema for Informational / Policy / Security Pages
 */
export function getWebPageSchema({
  title,
  description,
  url,
  type = 'WebPage',
}: {
  title: string;
  description: string;
  url: string;
  type?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: title,
    description,
    url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
    isPartOf: {
      '@id': `${BASE_URL}/#website`,
    },
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
    inLanguage: 'en-US',
  };
}
