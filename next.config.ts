import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/courses/intermediate-strategy-and-risk/:rest*', destination: '/courses/intermediate-forex-analysis/:rest*', permanent: true },
      { source: '/courses/pro-advanced-strategy/:rest*', destination: '/courses/pro-forex-trader/:rest*', permanent: true },
      { source: '/courses/full-path/:rest*', destination: '/courses/pro-forex-trader/:rest*', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
