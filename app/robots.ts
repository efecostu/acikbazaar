import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/portfolio', '/profile', '/onboarding'],
    },
    sitemap: `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://acikbazaar.com').replace(/\/+$/, '')}/sitemap.xml`,
  };
}
