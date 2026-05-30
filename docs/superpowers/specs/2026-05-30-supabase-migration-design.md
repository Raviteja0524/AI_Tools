# AI Tools — Supabase Migration Design

**Date:** 2026-05-30  
**Status:** Approved  
**Scope:** Migrate static JSON tool data to Supabase PostgreSQL; fix live bugs; prepare schema for future automation agent.

---

## 1. Problem

Tool data lives in `src/data/tools.json`. Editing it requires a code deploy. A future automation agent needs a real database to write to, and a Vercel deploy webhook to trigger site rebuilds after updates. Additionally, the live site has two bugs: all tool logos are 404, and the hero search placeholder has a hardcoded tool count.

---

## 2. Approach

**Supabase + Static Rebuild (Approach 1).**

Astro fetches all tool and category data from Supabase at build time. The compiled output is still 100% static HTML — no database queries at runtime. When data changes (manually or via the future agent), a Vercel deploy webhook triggers a rebuild (~45s). Visitors see no performance change.

```
Supabase DB ──── Astro build time fetch ──── Static HTML ──── Vercel CDN
     ↑                                                              ↑
Manual edits (table editor)                            Vercel deploy webhook
Agent writes (future)                              (called after DB is updated)
```

---

## 3. Database Schema

### `categories` table

| Column | Type | Constraints |
|---|---|---|
| `id` | text | PRIMARY KEY |
| `name` | text | NOT NULL |
| `icon` | text | NOT NULL |
| `color` | text | NOT NULL |
| `description` | text | NOT NULL |

### `tools` table

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | PRIMARY KEY | e.g. `chatgpt` |
| `name` | text | NOT NULL | |
| `slug` | text | NOT NULL UNIQUE | URL path segment |
| `tagline` | text | NOT NULL | one-liner |
| `description` | text | NOT NULL | 2–3 sentences |
| `logo` | text | NOT NULL | `/logos/chatgpt.svg` |
| `url` | text | NOT NULL | official website |
| `affiliate_url` | text | nullable | |
| `category` | text | NOT NULL, FK → categories.id | |
| `tags` | text[] | NOT NULL DEFAULT '{}' | |
| `pricing` | text | NOT NULL, CHECK IN ('free','freemium','paid') | |
| `indian_pricing` | text | nullable | e.g. `₹0 / ₹1,700/mo` |
| `rating` | numeric(2,1) | NOT NULL | 0.0–5.0 |
| `review_count` | integer | nullable | |
| `best_for_india` | boolean | NOT NULL DEFAULT false | |
| `free_forever` | boolean | NOT NULL DEFAULT false | |
| `featured` | boolean | NOT NULL DEFAULT false | |
| `languages` | text[] | DEFAULT '{}' | |
| `pros` | text[] | NOT NULL DEFAULT '{}' | |
| `cons` | text[] | NOT NULL DEFAULT '{}' | |
| `date_added` | date | NOT NULL | |
| `is_active` | boolean | NOT NULL DEFAULT true | soft-delete |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | |
| `source` | text | NOT NULL DEFAULT 'manual', CHECK IN ('manual','agent','import') | who added this row |
| `last_synced_at` | timestamptz | nullable | last agent verification timestamp |
| `needs_review` | boolean | NOT NULL DEFAULT false | agent sets true when uncertain |
| `agent_notes` | text | nullable | agent reasoning / discovery notes |

The final four columns (`source`, `last_synced_at`, `needs_review`, `agent_notes`) are unused by the current site but required by the future automation agent. Adding them now avoids a schema migration later.

---

## 4. Astro Integration

### New file: `src/lib/supabase.ts`

Initialises a Supabase client using environment variables. Used only at build time — no client-side exposure.

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
```

### Modified file: `src/utils/tools.ts`

Replace static JSON imports with async Supabase queries. All existing exports (`getFeaturedTools`, `getIndiaFavorites`, `getToolBySlug`, `categories`, etc.) keep their exact signatures — no page or component changes needed.

### Files unchanged

All pages, layouts, components, and styles are untouched. The data layer is the only thing changing.

---

## 5. Environment Variables

| Variable | Where set | Used by |
|---|---|---|
| `SUPABASE_URL` | `.env` + Vercel project settings | Astro build |
| `SUPABASE_ANON_KEY` | `.env` + Vercel project settings | Astro build |

No `PUBLIC_` prefix — these are build-time only and must not be embedded in client bundles. The anon key is safe for read-only build-time fetches. Row Level Security on Supabase allows public SELECT on `tools` and `categories`.

---

## 6. Vercel Deploy Webhook

Create a deploy webhook in Vercel project settings → copy the URL → document it. The future agent will POST to this URL after finishing its database writes to trigger a rebuild.

---

## 7. Data Migration

One-time script (`scripts/migrate-to-supabase.ts`):
1. Reads `src/data/tools.json` and `src/data/categories.json`
2. Maps camelCase JSON fields to snake_case DB columns
3. Inserts into Supabase via the JS client
4. Logs success/failure per row

After migration is verified, `tools.json` and `categories.json` stay as backup but are no longer imported by the app.

---

## 8. Bug Fix Track (parallel)

Independent of the database migration.

| Bug | File | Fix |
|---|---|---|
| All tool logos 404 | `/public/logos/` | Download/create SVG files for all 23+ tools |
| Hardcoded `"23+"` in hero search placeholder | `src/pages/index.astro:100` | Replace with `{totalTools}` |

---

## 9. Out of Scope

- Automation agent implementation (future session)
- SSR / hybrid rendering
- User-facing dynamic features (ratings, comments, submissions)
- Additional content (reviews, guides, blog posts)

---

## 10. Implementation Order

1. Set up Supabase project + create tables
2. Run migration script — verify data in table editor
3. Update `src/lib/supabase.ts` + `src/utils/tools.ts`
4. Test build locally
5. Add env vars to Vercel + deploy
6. Fix logos bug
7. Fix hardcoded count bug
8. Set up Vercel deploy webhook + document URL
