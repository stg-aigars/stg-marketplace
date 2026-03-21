import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/account/', '/checkout/', '/staff/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
