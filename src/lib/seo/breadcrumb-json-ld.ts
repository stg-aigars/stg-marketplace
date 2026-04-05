import type { WithContext, BreadcrumbList } from 'schema-dts';

interface BreadcrumbItem {
  name: string;
  url?: string;
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  baseUrl: string
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}` } : {}),
    })),
  };
}
