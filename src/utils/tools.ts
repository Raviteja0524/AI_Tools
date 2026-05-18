import toolsData from '@/data/tools.json';
import categoriesData from '@/data/categories.json';

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

export const tools = toolsData as Tool[];
export const categories = categoriesData as Category[];

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
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
