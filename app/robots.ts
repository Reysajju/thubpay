import { MetadataRoute } from 'next';
import { getURL } from '@/utils/helpers';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getURL() || 'https://thubpay.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/account/', '/auth/', '/_next/'],
    },
    host: baseUrl,
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
