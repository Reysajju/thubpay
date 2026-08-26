import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdfkit', 'bcryptjs'],
  images: {
    // H17 fix: previously `hostname: '**'` allowed next/image to optimize
    // any HTTPS host. Combined with the PDF generators that fetch arbitrary
    // URLs from `workspace.logoUrl`, this was an SSRF surface. We now
    // restrict to a known allowlist. Add to this list when you onboard a
    // new logo storage provider. (For dev we still allow localhost.)
    remotePatterns: [
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'https', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
