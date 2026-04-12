import { MetadataRoute } from 'next';
import { getURL } from '@/utils/helpers';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getURL() || 'https://thubpay.com';
  const marketingPages = [
    '/about-us',
    '/contact-us',
    '/blogs',
    '/faqs',
    '/how-it-works',
    '/terms-and-conditions',
    '/privacy-policy',
    '/security'
  ];

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/signin`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...marketingPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8
    }))
  ];
}
