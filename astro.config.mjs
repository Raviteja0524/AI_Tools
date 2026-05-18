import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const SITE_URL = 'https://ai-tools-free24.vercel.app';

export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    react(),
    sitemap({
      // Add lastmod, priority, and changefreq to every URL
      serialize(item) {
        item.lastmod = new Date().toISOString();

        if (item.url === `${SITE_URL}/`) {
          item.changefreq = 'daily';
          item.priority = 1.0;
        } else if (item.url.startsWith(`${SITE_URL}/tools/`) && item.url !== `${SITE_URL}/tools/`) {
          // Individual tool pages — high value, updated occasionally
          item.changefreq = 'weekly';
          item.priority = 0.85;
        } else if (item.url === `${SITE_URL}/tools/`) {
          item.changefreq = 'daily';
          item.priority = 0.95;
        } else if (
          item.url.startsWith(`${SITE_URL}/reviews/`) ||
          item.url.startsWith(`${SITE_URL}/guides/`) ||
          item.url.startsWith(`${SITE_URL}/blog/`)
        ) {
          item.changefreq = 'weekly';
          item.priority = 0.75;
        } else {
          item.changefreq = 'monthly';
          item.priority = 0.5;
        }

        return item;
      },
    }),
  ],
  output: 'static',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      rollupOptions: {
        // Pagefind JS is generated after build — don't try to bundle it
        external: ['/pagefind/pagefind-ui.js'],
      },
    },
  },
});
