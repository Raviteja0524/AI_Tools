export const SITE_NAME = 'AI Tools';
export const SITE_URL = 'https://bestaitools.in';
export const SITE_DESCRIPTION =
  "India's best directory of free AI tools for developers, students, and freelancers. Honest reviews and India-specific pricing.";

export function toolSeoTitle(toolName: string): string {
  return `${toolName} Review 2026 — Is It Worth It for Indians? | AI Tools`;
}

export function toolSeoDescription(tool: {
  name: string;
  tagline: string;
  pricing: string;
  indianPricing?: string;
}): string {
  const price = tool.indianPricing ? ` India pricing: ${tool.indianPricing}.` : '';
  return `${tool.tagline}${price} Read our honest ${tool.name} review for Indian developers, students & freelancers.`.slice(0, 160);
}

export function categorySeoTitle(categoryName: string): string {
  return `Best Free ${categoryName} AI Tools for India 2026`;
}

export function buildSchemaForTool(tool: {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  url: string;
  logo?: string;
  rating: number;
  reviewCount?: number;
  pricing: string;
  pros?: string[];
  category?: string;
  languages?: string[];
  freeForever?: boolean;
}) {
  const priceCurrency = 'INR';
  const isFree = tool.pricing === 'free' || tool.freeForever;

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description: tool.description,
    url: `${SITE_URL}/tools/${tool.slug}`,
    applicationUrl: tool.url,
    ...(tool.logo ? { image: `${SITE_URL}${tool.logo}` } : {}),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web, Windows, Mac, Linux',
    ...(tool.languages?.length ? { inLanguage: tool.languages } : {}),
    ...(tool.pros?.length ? { featureList: tool.pros.join(', ') } : {}),
    offers: {
      '@type': 'Offer',
      price: isFree ? '0' : undefined,
      priceCurrency,
      ...(isFree ? { availability: 'https://schema.org/InStock' } : {}),
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: tool.rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: tool.reviewCount ?? 100,
    },
  };
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
