import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturngames.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/en`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/en/browse`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/en/terms`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/en/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/en/contact`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Dynamic listing pages
  let listingPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: listings } = await supabase
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (listings) {
      listingPages = listings.map((listing) => ({
        url: `${baseUrl}/en/listings/${listing.id}`,
        lastModified: listing.updated_at,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // Sitemap generation should not fail the build if DB is unreachable
  }

  return [...staticPages, ...listingPages];
}
