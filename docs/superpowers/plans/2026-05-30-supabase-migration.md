# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static `tools.json`/`categories.json` with Supabase PostgreSQL, fix the live logo-404 and hardcoded-count bugs, and document the Vercel deploy webhook for the future automation agent.

**Architecture:** Astro fetches all tool and category data from Supabase using top-level await in `src/utils/tools.ts` at build time. The compiled output stays 100% static HTML — no DB queries at runtime, no performance change for visitors. When data changes, a Vercel deploy webhook triggers a rebuild (~45s).

**Tech Stack:** Astro 5, @supabase/supabase-js v2, TypeScript, tsx (script runner), dotenv

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `supabase/schema.sql` | Reproducible schema — run once in Supabase SQL editor |
| Create | `src/lib/supabase.ts` | Supabase client using `import.meta.env` (Astro build-time only) |
| Create | `scripts/migrate-to-supabase.ts` | One-time data migration from JSON → Supabase |
| Create | `scripts/generate-logos.ts` | Generates SVG logo files for all 37 tools |
| Create | `.env.example` | Documents required env vars |
| Modify | `src/utils/tools.ts` | Swap JSON imports for Supabase queries; all exports stay identical |
| Modify | `src/pages/index.astro` (line ~100) | Fix hardcoded `"23+"` in hero search placeholder |
| Modify | `package.json` | Add `@supabase/supabase-js`, `dotenv`, `tsx`; add `migrate` and `logos` scripts |
| Add | `public/logos/*.svg` | 37 tool logo SVG files |

---

### Task 1: Create Supabase schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/schema.sql`**

```sql
-- Categories table
CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  description TEXT NOT NULL
);

-- Tools table
CREATE TABLE tools (
  id             TEXT          PRIMARY KEY,
  name           TEXT          NOT NULL,
  slug           TEXT          NOT NULL UNIQUE,
  tagline        TEXT          NOT NULL,
  description    TEXT          NOT NULL,
  logo           TEXT          NOT NULL,
  url            TEXT          NOT NULL,
  affiliate_url  TEXT,
  category       TEXT          NOT NULL REFERENCES categories(id),
  tags           TEXT[]        NOT NULL DEFAULT '{}',
  pricing        TEXT          NOT NULL CHECK (pricing IN ('free','freemium','paid')),
  indian_pricing TEXT,
  rating         NUMERIC(2,1)  NOT NULL,
  review_count   INTEGER,
  best_for_india BOOLEAN       NOT NULL DEFAULT false,
  free_forever   BOOLEAN       NOT NULL DEFAULT false,
  featured       BOOLEAN       NOT NULL DEFAULT false,
  languages      TEXT[]                 DEFAULT '{}',
  pros           TEXT[]        NOT NULL DEFAULT '{}',
  cons           TEXT[]        NOT NULL DEFAULT '{}',
  date_added     DATE          NOT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Agent-ready columns (unused by site now; required by future automation agent)
  source         TEXT          NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','agent','import')),
  last_synced_at TIMESTAMPTZ,
  needs_review   BOOLEAN       NOT NULL DEFAULT false,
  agent_notes    TEXT
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security — allow anon read (needed for build-time fetch with anon key)
ALTER TABLE tools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on tools"
  ON tools FOR SELECT USING (true);

CREATE POLICY "Public read on categories"
  ON categories FOR SELECT USING (true);
```

- [ ] **Step 2: Run schema in Supabase dashboard**

1. Supabase dashboard → SQL Editor → New query
2. Paste the full contents of `supabase/schema.sql`
3. Click **Run**
4. Verify: Table Editor → should show `tools` and `categories` tables

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema for tools and categories"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Supabase client**

```bash
npm install @supabase/supabase-js
```

Expected: `@supabase/supabase-js` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D dotenv tsx
```

Expected: `dotenv` and `tsx` appear in `devDependencies`.

- [ ] **Step 3: Add scripts to `package.json`**

Add these two entries to the `"scripts"` block:

```json
"migrate": "tsx scripts/migrate-to-supabase.ts",
"logos":   "tsx scripts/generate-logos.ts"
```

Full updated scripts block:

```json
"scripts": {
  "dev":          "astro dev",
  "build":        "astro build",
  "preview":      "astro preview",
  "astro":        "astro",
  "search:build": "pagefind --site dist",
  "build:full":   "astro build && pagefind --site dist",
  "migrate":      "tsx scripts/migrate-to-supabase.ts",
  "logos":        "tsx scripts/generate-logos.ts"
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add supabase-js, dotenv, tsx dependencies"
```

---

### Task 3: Create `.env.example` and Supabase client

**Files:**
- Create: `.env.example`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create `.env.example`**

```
# Supabase — get from your project: Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Vercel deploy webhook — documented in Task 10
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
```

- [ ] **Step 2: Create `.env` with real values**

```bash
cp .env.example .env
```

Open `.env` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase → Settings → API → Project URL + anon/public key. Leave `VERCEL_DEPLOY_HOOK_URL` until Task 10.

- [ ] **Step 3: Confirm `.env` is gitignored**

```bash
grep -q '\.env' .gitignore && echo "already ignored" || echo '.env' >> .gitignore
```

- [ ] **Step 4: Create `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(url, key);
```

- [ ] **Step 5: Commit**

```bash
git add .env.example src/lib/supabase.ts .gitignore
git commit -m "feat: add Supabase client and env config"
```

---

### Task 4: Write migration script

**Files:**
- Create: `scripts/migrate-to-supabase.ts`

- [ ] **Step 1: Create `scripts/migrate-to-supabase.ts`**

```typescript
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
```

- [ ] **Step 2: Run the migration**

```bash
npm run migrate
```

Expected output:
```
Migrating categories...
✓  8 categories inserted
Migrating tools...
✓  37 tools inserted
✅  Migration complete
```

- [ ] **Step 3: Verify in Supabase**

Supabase dashboard → Table Editor → `tools`. Confirm 37 rows. Click a row and verify the `pros`, `cons`, and `tags` arrays are populated (not empty).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-supabase.ts
git commit -m "feat: add one-time Supabase migration script"
```

---

### Task 5: Rewrite `src/utils/tools.ts`

**Files:**
- Modify: `src/utils/tools.ts`

> All exported function signatures stay identical — no callers, pages, or components need changes.

- [ ] **Step 1: Replace the entire file**

```typescript
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

export const tools: Tool[]       = (rawTools      ?? []).map(mapTool);
export const categories: Category[] = (rawCategories ?? []) as Category[];

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
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/tools.ts
git commit -m "feat: fetch tools and categories from Supabase at build time"
```

---

### Task 6: Test local build

**Files:** none changed

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Watch for errors. Common failures and fixes:

| Error | Fix |
|---|---|
| `Missing SUPABASE_URL or SUPABASE_ANON_KEY` | `.env` file is missing or has placeholder values — paste real credentials |
| `Supabase tools fetch failed: ...` | Check the anon key and URL in Supabase → Settings → API |
| TypeScript type error in `tools.ts` | Confirm you replaced the full file, not just part of it |

Expected: `build complete` with no errors.

- [ ] **Step 2: Preview and spot-check**

```bash
npm run preview
```

Open http://localhost:4321 and verify:
- Hero stats show the correct tool count (37+)
- "Trending AI Tools" section shows cards with data
- `/tools` loads the full directory
- `/tools/chatgpt` shows the ChatGPT detail page with pros, cons, Indian pricing

---

### Task 7: Deploy to Vercel

**Files:** none changed

- [ ] **Step 1: Add env vars in Vercel dashboard**

Vercel → your project → Settings → Environment Variables. Add both for Production, Preview, and Development:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | `your-anon-key` |

- [ ] **Step 2: Push to trigger deploy**

```bash
git push origin worktree-supabase-migration
```

Then open a PR to `main` and merge it — or push directly to `main` if that's your workflow.

- [ ] **Step 3: Verify live site**

Once the Vercel build log shows success, open https://ai-tools-free24.vercel.app and confirm tools load correctly.

---

### Task 8: Generate logos for all 37 tools

**Files:**
- Create: `scripts/generate-logos.ts`
- Create: `public/logos/*.svg` (37 files)

- [ ] **Step 1: Create `scripts/generate-logos.ts`**

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/logos');
mkdirSync(OUT, { recursive: true });

const LOGOS: Record<string, { letter: string; bg: string; fg?: string }> = {
  'chatgpt.svg':          { letter: 'G', bg: '#10A37F' },
  'claude.svg':           { letter: 'C', bg: '#CC785C' },
  'gemini.svg':           { letter: 'G', bg: '#4285F4' },
  'copilot.svg':          { letter: 'C', bg: '#0078D4' },
  'perplexity.svg':       { letter: 'P', bg: '#1FB8CD' },
  'grammarly.svg':        { letter: 'G', bg: '#15C39A' },
  'github-copilot.svg':   { letter: 'G', bg: '#24292E' },
  'cursor.svg':           { letter: 'C', bg: '#000000' },
  'codeium.svg':          { letter: 'C', bg: '#09B585' },
  'ollama.svg':           { letter: 'O', bg: '#1C1C1E' },
  'lm-studio.svg':        { letter: 'L', bg: '#8B5CF6' },
  'notebooklm.svg':       { letter: 'N', bg: '#4285F4' },
  'midjourney.svg':       { letter: 'M', bg: '#000000' },
  'stable-diffusion.svg': { letter: 'S', bg: '#CF4500' },
  'canva.svg':            { letter: 'C', bg: '#00C4CC' },
  'elevenlabs.svg':       { letter: 'E', bg: '#1A1A1A' },
  'murf.svg':             { letter: 'M', bg: '#6366F1' },
  'whisper.svg':          { letter: 'W', bg: '#10A37F' },
  'chatpdf.svg':          { letter: 'C', bg: '#FF5733' },
  'rytr.svg':             { letter: 'R', bg: '#5B4EF5' },
  'suno.svg':             { letter: 'S', bg: '#1A1A1A' },
  'gpt4all.svg':          { letter: 'G', bg: '#412991' },
  'aider.svg':            { letter: 'A', bg: '#2D3748' },
  'notion.svg':           { letter: 'N', bg: '#1A1A1A' },
  'runway.svg':           { letter: 'R', bg: '#1A1A1A' },
  'adobe-firefly.svg':    { letter: 'A', bg: '#FF0000' },
  'jasper.svg':           { letter: 'J', bg: '#FF7A59' },
  'jan.svg':              { letter: 'J', bg: '#5C6BC0' },
  'anythingllm.svg':      { letter: 'A', bg: '#5C2D91' },
  'consensus.svg':        { letter: 'C', bg: '#2563EB' },
  'tabnine.svg':          { letter: 'T', bg: '#7B61FF' },
  'codewhisperer.svg':    { letter: 'Q', bg: '#FF9900', fg: '#000000' },
  'continue.svg':         { letter: 'C', bg: '#1C1C1E' },
  'leonardo.svg':         { letter: 'L', bg: '#FF6B35' },
  'kling.svg':            { letter: 'K', bg: '#1A1A1A' },
  'replit.svg':           { letter: 'R', bg: '#F26207' },
  'huggingface.svg':      { letter: 'H', bg: '#FFD21E', fg: '#1A1A1A' },
};

function makeSvg(letter: string, bg: string, fg = '#FFFFFF'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <rect width="40" height="40" rx="8" fill="${bg}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,-apple-system,sans-serif"
    font-size="18" font-weight="700" fill="${fg}">${letter}</text>
</svg>`;
}

for (const [filename, { letter, bg, fg }] of Object.entries(LOGOS)) {
  writeFileSync(resolve(OUT, filename), makeSvg(letter, bg, fg));
}

console.log(`✅  Generated ${Object.keys(LOGOS).length} logos in public/logos/`);
```

- [ ] **Step 2: Run the script**

```bash
npm run logos
```

Expected output:
```
✅  Generated 37 logos in public/logos/
```

- [ ] **Step 3: Verify file count**

```bash
ls public/logos/ | wc -l
```

Expected: `37`

- [ ] **Step 4: Rebuild and preview**

```bash
npm run build && npm run preview
```

Open http://localhost:4321 — tool cards should now show colored letter icons instead of broken images.

- [ ] **Step 5: Commit**

```bash
git add public/logos/ scripts/generate-logos.ts
git commit -m "feat: generate SVG placeholder logos for all 37 tools"
```

---

### Task 9: Fix hardcoded tool count in hero search

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Find and replace the hardcoded placeholder**

In `src/pages/index.astro`, find this line (around line 100):

```astro
placeholder="Search 23+ AI tools — try 'free coding' or 'local LLM'..."
```

Replace with (uses `totalTools` already defined at top of the file):

```astro
placeholder={`Search ${totalTools}+ AI tools — try 'free coding' or 'local LLM'...`}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "fix: dynamic tool count in hero search placeholder"
```

---

### Task 10: Set up Vercel deploy webhook

No code files. Vercel dashboard action + `.env.example` update.

- [ ] **Step 1: Create the webhook in Vercel**

1. Vercel dashboard → your project → Settings → Git → Deploy Hooks
2. Click **Create Hook**
3. Name: `Automation Agent Trigger`, Branch: `main`
4. Click **Create Hook** — copy the generated URL (looks like `https://api.vercel.com/v1/integrations/deploy/prj_xxx/...`)

- [ ] **Step 2: Add the URL to your `.env`**

Open `.env` and set:

```
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
```

- [ ] **Step 3: Test the webhook fires a deploy**

```bash
curl -X POST "$(grep VERCEL_DEPLOY_HOOK_URL .env | cut -d= -f2-)"
```

Expected: `{"job":{"id":"...","state":"PENDING",...}}` — Vercel starts a new deployment (visible in Vercel dashboard → Deployments).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: add Vercel deploy webhook env var to example"
```

---

## Done

After all 10 tasks:
- Tools and categories are served from Supabase — editable via Supabase table editor without a code deploy
- All 37 tool logos render as clean colored SVGs (no more 404s)
- Hero search placeholder count is dynamic
- Vercel deploy webhook is ready for the future automation agent to call after DB writes
- `scripts/migrate-to-supabase.ts` can be kept as reference; `src/data/tools.json` and `src/data/categories.json` stay as backup
