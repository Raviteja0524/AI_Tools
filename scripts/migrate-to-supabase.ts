import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const categories = JSON.parse(
  readFileSync(resolve(root, 'src/data/categories.json'), 'utf-8')
);
const toolsRaw = JSON.parse(
  readFileSync(resolve(root, 'src/data/tools.json'), 'utf-8')
);

function mapTool(t: Record<string, unknown>) {
  return {
    id:             t.id,
    name:           t.name,
    slug:           t.slug,
    tagline:        t.tagline,
    description:    t.description,
    logo:           t.logo,
    url:            t.url,
    affiliate_url:  t.affiliateUrl   ?? null,
    category:       t.category,
    tags:           t.tags           ?? [],
    pricing:        t.pricing,
    indian_pricing: t.indianPricing  ?? null,
    rating:         t.rating,
    review_count:   t.reviewCount    ?? null,
    best_for_india: t.bestForIndia,
    free_forever:   t.freeForever,
    featured:       t.featured,
    languages:      t.languages      ?? [],
    pros:           t.pros           ?? [],
    cons:           t.cons           ?? [],
    date_added:     t.dateAdded,
    source:         'import',
  };
}

async function run() {
  console.log('Migrating categories...');
  const { error: catErr } = await supabase.from('categories').insert(categories);
  if (catErr) { console.error('❌  Categories:', catErr.message); process.exit(1); }
  console.log(`✓  ${categories.length} categories inserted`);

  console.log('Migrating tools...');
  const mapped = toolsRaw.map(mapTool);
  const { error: toolErr } = await supabase.from('tools').insert(mapped);
  if (toolErr) { console.error('❌  Tools:', toolErr.message); process.exit(1); }
  console.log(`✓  ${mapped.length} tools inserted`);

  console.log('✅  Migration complete');
}

run();
