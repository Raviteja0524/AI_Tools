import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const reviews = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/reviews' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    toolSlug: z.string(),
    toolName: z.string(),
    rating: z.number().min(0).max(5),
    verdict: z.string(),                            // one-line summary for cards
    pricingTier: z.enum(['free', 'freemium', 'paid']),
    indianPricing: z.string().optional(),
    datePublished: z.string(),
    dateModified: z.string().optional(),
    author: z.string().default('AI Tools India'),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    timeToRead: z.string(),                         // e.g. "8 min read"
    datePublished: z.string(),
    dateModified: z.string().optional(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    datePublished: z.string(),
    dateModified: z.string().optional(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    readingTime: z.string().optional(),             // e.g. "6 min read"
  }),
});

export const collections = { reviews, guides, blog };
