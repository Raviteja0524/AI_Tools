import { supabase } from '@/lib/supabase';

export interface Tool {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logo: string;
  url: string;
  affiliateUrl?: string;
  category: string;
  tags: string[];
  pricing: 'free' | 'freemium' | 'paid';
  indianPricing?: string;
  rating: number;
  reviewCount?: number;
  bestForIndia: boolean;
  freeForever: boolean;
  featured: boolean;
  languages?: string[];
  pros: string[];
  cons: string[];
  dateAdded: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

function mapTool(row: Record<string, unknown>): Tool {
  return {
    id:            row.id            as string,
    name:          row.name          as string,
    slug:          row.slug          as string,
    tagline:       row.tagline       as string,
    description:   row.description   as string,
    logo:          row.logo          as string,
    url:           row.url           as string,
    affiliateUrl:  (row.affiliate_url  as string  | null) ?? undefined,
    category:      row.category      as string,
    tags:          (row.tags         as string[]) ?? [],
    pricing:       row.pricing       as 'free' | 'freemium' | 'paid',
    indianPricing: (row.indian_pricing as string  | null) ?? undefined,
    rating:        Number(row.rating),
    reviewCount:   (row.review_count  as number  | null) ?? undefined,
    bestForIndia:  row.best_for_india as boolean,
    freeForever:   row.free_forever   as boolean,
    featured:      row.featured       as boolean,
    languages:     (row.languages    as string[] | null) ?? undefined,
    pros:          (row.pros         as string[]) ?? [],
    cons:          (row.cons         as string[]) ?? [],
    dateAdded:     row.date_added    as string,
  };
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id:          row.id          as string,
    name:        row.name        as string,
    icon:        row.icon        as string,
    color:       row.color       as string,
    description: row.description as string,
  };
}

// Fetched once when module is first imported during the Astro build.
const { data: rawTools, error: toolsError } = await supabase
  .from('tools')
  .select('*')
  .eq('is_active', true)
  .order('rating', { ascending: false });

if (toolsError) throw new Error(`Supabase tools fetch failed: ${toolsError.message}`);

const { data: rawCategories, error: categoriesError } = await supabase
  .from('categories')
  .select('*')
  .order('name');

if (categoriesError) throw new Error(`Supabase categories fetch failed: ${categoriesError.message}`);

export const tools: Tool[]          = (rawTools      ?? []).map(mapTool);
export const categories: Category[] = (rawCategories ?? []).map(mapCategory);

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find(t => t.slug === slug);
}

export function getFeaturedTools(limit = 6): Tool[] {
  return tools.filter(t => t.featured).slice(0, limit);
}

export function getToolsByCategory(categoryId: string): Tool[] {
  return tools.filter(t => t.category === categoryId);
}

export function getIndiaFavorites(limit = 6): Tool[] {
  return tools.filter(t => t.bestForIndia).slice(0, limit);
}

export function getFreeForeverTools(): Tool[] {
  return tools.filter(t => t.freeForever);
}

export function getNewTools(limit = 6): Tool[] {
  return [...tools]
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, limit);
}

export function getRelatedTools(tool: Tool, limit = 3): Tool[] {
  return tools
    .filter(t => t.id !== tool.id && t.category === tool.category)
    .slice(0, limit);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id);
}

export function getToolCount(): number {
  return tools.length;
}

export function getToolCountByPricing(pricing: 'free' | 'freemium' | 'paid'): number {
  return tools.filter(t => t.pricing === pricing).length;
}

export function renderStars(rating: number): string {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
