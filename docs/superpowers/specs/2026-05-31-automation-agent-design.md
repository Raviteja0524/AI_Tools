# AI Tools — Automation Agent Design

**Date:** 2026-05-31  
**Status:** Approved  
**Scope:** GitHub Actions cron job that discovers new AI tools via Brave Search, evaluates them with Gemini 1.5 Flash, writes approved tools to Supabase, and triggers a Vercel rebuild. Runs twice weekly. Completely free.

---

## 1. Problem

New AI tools launch daily. The Supabase-backed site currently requires manual editing to add new tools. An automated pipeline should discover, evaluate, and publish new tools on a schedule — with zero manual intervention and zero cost.

---

## 2. Architecture

**Linear Pipeline (single Python script, GitHub Actions cron).**

```
GitHub Actions cron (Mon + Thu, midnight UTC)
  → agent/discover_tools.py
  → Brave Search API: 8 rotating queries → ~80 raw results
  → Deduplicate against existing Supabase tools
  → Up to 15 candidates → Gemini 1.5 Flash evaluation
  → Supabase upsert (source='agent', is_active=true)
  → POST Vercel deploy webhook (only if ≥1 new tool added)
```

No new infrastructure. No servers. No cost.

---

## 3. Components

### 3.1 Search Strategy

8 rotating query templates per run, split across Monday and Thursday runs:

**Monday queries:**
- `"new AI tools developers 2026"`
- `"free AI coding assistant 2026"`
- `"best AI writing tools free 2026"`
- `"new AI productivity tools 2026"`
- `"local LLM tools 2026 free"`
- `"AI image generation free tier 2026"`
- `"AI tools for students free 2026"`
- `"AI research tools free 2026"`

**Thursday queries:**
- `"new AI chatbot tools 2026"`
- `"free AI tools Indian users"`
- `"AI video tools free 2026"`
- `"AI audio transcription free 2026"`
- `"best AI tools for freelancers 2026"`
- `"AI automation tools free 2026"`
- `"new generative AI tools 2026"`
- `"open source AI tools 2026"`

**Quota:** 8 queries × 2 runs/week × 4 weeks = 64 searches/month (vs. 2000/month free limit).

Each query returns top 10 results → ~80 raw candidates per run.

### 3.2 Deduplication

Before calling Gemini (to conserve quota), filter candidates:

1. **Domain match** — extract URL domain; skip if it matches any existing `tools.url` domain in Supabase
2. **Name similarity** — skip if result title shares 3+ words with an existing tool name (case-insensitive)
3. **Domain blocklist** — skip results from: `medium.com`, `producthunt.com`, `reddit.com`, `forbes.com`, `techcrunch.com`, `venturebeat.com`, `theverge.com`, `wired.com`, `towardsdatascience.com`
4. **Cap** — take max 15 candidates per run to Gemini

### 3.3 Gemini Evaluation + Extraction

For each candidate:
1. Fetch first 3000 characters of page HTML via `urllib.request`
2. Send to Gemini 1.5 Flash with a structured prompt
3. Parse JSON response

**Gemini prompt:**

System:
```
You are an AI tool curator. Given a URL, page excerpt, and search snippet, determine if this is a real standalone AI-powered tool (not a blog post, listicle, or company homepage). If it is, extract structured data. Return JSON only.
```

User template:
```
Tool URL: {url}
Tool name from search: {title}
Search snippet: {snippet}
Page excerpt (first 3000 chars): {page_text}

Available category IDs:
- writing-productivity
- coding-assistants
- image-video
- local-llms
- audio-voice
- research-data
- business-marketing
- education

Return this exact JSON schema:
{
  "is_ai_tool": true,
  "name": "Tool Name",
  "slug": "tool-name",
  "tagline": "One line, under 80 chars",
  "description": "2-3 sentences describing what it does.",
  "url": "https://official-url.com",
  "category": "one-of-8-ids",
  "tags": ["tag1", "tag2", "tag3"],
  "pricing": "free|freemium|paid",
  "indian_pricing": "₹0 / ₹X/mo or null",
  "rating": 4.0,
  "best_for_india": false,
  "free_forever": false,
  "pros": ["Pro one", "Pro two", "Pro three"],
  "cons": ["Con one", "Con two"],
  "logo_domain": "officialdomain.com"
}

If NOT an AI tool, return: {"is_ai_tool": false, "skip_reason": "..."}

Rating guidance: use 3.5–4.2 for new tools. Default to 3.8 unless evidence (free tier, wide adoption) justifies higher.
```

**Gemini quota:** ~600 tokens/call × 15 candidates × 8 runs/month = ~72,000 tokens/month. Free tier: 1.5M tokens/day.

### 3.4 Logo

Agent-added tools use Clearbit Logo API (free):
- `logo` field = `https://logo.clearbit.com/<logo_domain>` (e.g. `https://logo.clearbit.com/anthropic.com`)
- External URL works in `<img src>` with no site code changes
- 404 renders as broken image (acceptable MVP; no onerror handler needed now)

### 3.5 Supabase Write

```python
tool_row = {
    # All fields from Gemini output (snake_case) ...
    "logo": f"https://logo.clearbit.com/{logo_domain}",
    "source": "agent",
    "last_synced_at": datetime.utcnow().isoformat() + "Z",
    "needs_review": False,
    "is_active": True,
    "date_added": date.today().isoformat(),
    "review_count": None,
    "affiliate_url": None,
    "languages": [],
}
supabase.table("tools").upsert(tool_row, on_conflict="slug").execute()
```

Uses `SUPABASE_SERVICE_ROLE_KEY` (GitHub Actions secret only — never Vercel, never committed).

### 3.6 Vercel Deploy Webhook

After all upserts, if at least 1 new tool was successfully written:
```python
import requests
requests.post(os.environ["VERCEL_DEPLOY_HOOK_URL"], timeout=10)
```

Site rebuild takes ~45s. No response handling needed.

---

## 4. GitHub Actions Workflow

```yaml
# .github/workflows/tool-discovery.yml
name: AI Tool Discovery

on:
  schedule:
    - cron: '0 0 * * 1,4'   # Monday + Thursday, midnight UTC
  workflow_dispatch:          # manual trigger for testing

jobs:
  discover:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r agent/requirements.txt
      - name: Run discovery agent
        run: python agent/discover_tools.py
        env:
          BRAVE_API_KEY: ${{ secrets.BRAVE_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}
```

---

## 5. File Structure

```
agent/
├── discover_tools.py     ← main script
├── requirements.txt      ← supabase, google-generativeai, requests, python-slugify, pyyaml
└── queries.yaml          ← search query templates per weekday
.github/
└── workflows/
    └── tool-discovery.yml
```

No changes to `src/`, components, or pages. The site already handles external logo URLs.

---

## 6. Rate Limiting

| Step | Delay | Reason |
|---|---|---|
| Between Brave queries | 1s sleep | API politeness |
| Between Gemini calls | 4s sleep | Stay under 15 req/min free limit |
| urllib page fetch | 5s timeout | Avoid hanging on slow sites |

---

## 7. Quota Summary

| API | Free limit | Our usage | Headroom |
|---|---|---|---|
| Brave Search | 2000/month | ~64/month | 97% |
| Gemini 1.5 Flash | 1500 req/day | ~15/run | 99%+ |
| Supabase writes | Unlimited | ~10 rows/run | — |
| Vercel webhook | Unlimited | 1 POST/run | — |
| GitHub Actions | 2000 min/month (public: unlimited) | ~5 min/run | — |

---

## 8. GitHub Actions Secrets Required

| Secret | Where to get |
|---|---|
| `BRAVE_API_KEY` | api.search.brave.com → New Application → Free plan |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key → Free tier |
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API → service_role key |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel project → Settings → Git → Deploy Hooks → Create hook |

---

## 9. Out of Scope

- Tool quality scoring / ML ranking
- Human review queue UI
- Duplicate detection beyond URL domain + name match
- Logo upload to Supabase Storage
- Email/Slack notifications on run completion
- Backfilling existing tools with agent metadata

---

## 10. Implementation Order

1. Create `agent/queries.yaml`
2. Create `agent/requirements.txt`
3. Write `agent/discover_tools.py` (search → dedup → Gemini → Supabase → webhook)
4. Create `.github/workflows/tool-discovery.yml`
5. Add GitHub Actions secrets in repo settings
6. Manual test via `workflow_dispatch`
7. Verify new tool appears in Supabase and site rebuilds
