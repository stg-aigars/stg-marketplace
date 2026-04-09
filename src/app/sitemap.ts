import type { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/wanted`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/sell`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/help`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/help/packing`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  let listingPages: MetadataRoute.Sitemap = [];
  let sellerPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();

    const { data: listings } = await supabase
      .from('listings')
      .select('id, seller_id, updated_at')
      .in('status', ['active', 'reserved'])
      .order('updated_at', { ascending: false })
      .limit(5000);

    if (listings) {
      listingPages = listings.map((listing) => ({
        url: `${baseUrl}/listings/${listing.id}`,
        lastModified: listing.updated_at,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

      // One entry per seller — listings ordered newest-first, so first occurrence = most recent activity
      const sellerMap = new Map<string, string>();
      for (const row of listings) {
        if (!sellerMap.has(row.seller_id)) {
          sellerMap.set(row.seller_id, row.updated_at);
        }
      }

      sellerPages = Array.from(sellerMap.entries()).map(
        ([sellerId, updatedAt]) => ({
          url: `${baseUrl}/sellers/${sellerId}`,
          lastModified: updatedAt,
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        })
      );
    }
  } catch {
    // Sitemap generation should not fail the build if DB is unreachable
  }

  return [...staticPages, ...listingPages, ...sellerPages];
}
