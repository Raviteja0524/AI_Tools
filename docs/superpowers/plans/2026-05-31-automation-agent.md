# Automation Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Actions cron job that discovers new AI tools twice weekly via Brave Search + Gemini 1.5 Flash, writes them to Supabase, and triggers a Vercel rebuild — entirely free.

**Architecture:** A single Python script (`agent/discover_tools.py`) runs on a GitHub Actions schedule. It queries Brave Search for new AI tools, deduplicates against Supabase, evaluates candidates with Gemini 1.5 Flash, upserts approved tools, and fires the Vercel deploy webhook. No new infrastructure. No runtime cost.

**Tech Stack:** Python 3.11, `google-generativeai`, `supabase` (Python client), `requests`, `python-slugify`, `pyyaml`, GitHub Actions cron, Brave Search API (free tier), Gemini 1.5 Flash (free tier).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `agent/queries.yaml` | Create | Search query templates per weekday |
| `agent/requirements.txt` | Create | Python dependencies |
| `agent/tests/__init__.py` | Create | Empty — makes tests a package |
| `agent/tests/test_discover_tools.py` | Create | Unit tests for pure helper functions |
| `agent/discover_tools.py` | Create | Main script — all pipeline logic |
| `.github/workflows/tool-discovery.yml` | Create | Cron schedule + secrets wiring |

No changes to `src/`, Astro pages, or components.

---

## Context: Existing Schema

The Supabase `tools` table (from `supabase/schema.sql`) has these columns relevant to the agent:

```
id TEXT PRIMARY KEY         -- same as slug
name TEXT NOT NULL
slug TEXT NOT NULL UNIQUE
tagline TEXT NOT NULL
description TEXT NOT NULL
logo TEXT NOT NULL
url TEXT NOT NULL
affiliate_url TEXT          -- nullable
category TEXT NOT NULL      -- FK → categories.id
tags TEXT[] NOT NULL DEFAULT '{}'
pricing TEXT NOT NULL       -- 'free'|'freemium'|'paid'
indian_pricing TEXT         -- nullable
rating NUMERIC(2,1) NOT NULL
review_count INTEGER        -- nullable
best_for_india BOOLEAN NOT NULL DEFAULT false
free_forever BOOLEAN NOT NULL DEFAULT false
featured BOOLEAN NOT NULL DEFAULT false
languages TEXT[] DEFAULT '{}'
pros TEXT[] NOT NULL DEFAULT '{}'
cons TEXT[] NOT NULL DEFAULT '{}'
date_added DATE NOT NULL
is_active BOOLEAN NOT NULL DEFAULT true
source TEXT NOT NULL DEFAULT 'manual'  -- agent writes 'agent'
last_synced_at TIMESTAMPTZ             -- nullable
needs_review BOOLEAN NOT NULL DEFAULT false
agent_notes TEXT                       -- nullable
```

Valid category IDs: `writing-productivity`, `coding-assistants`, `image-video`, `local-llms`, `audio-voice`, `research-data`, `business-marketing`, `education`

---

## Task 1: Static Config Files

**Files:**
- Create: `agent/queries.yaml`
- Create: `agent/requirements.txt`
- Create: `agent/tests/__init__.py`

- [ ] **Step 1: Create `agent/queries.yaml`**

```yaml
# agent/queries.yaml
# Queries rotate by weekday. Monday and Thursday are the cron days.
# Add/remove queries freely — each run uses the day's list.

monday:
  - "new AI tools developers 2026"
  - "free AI coding assistant 2026"
  - "best AI writing tools free 2026"
  - "new AI productivity tools 2026"
  - "local LLM tools 2026 free"
  - "AI image generation free tier 2026"
  - "AI tools for students free 2026"
  - "AI research tools free 2026"

thursday:
  - "new AI chatbot tools 2026"
  - "free AI tools Indian users"
  - "AI video tools free 2026"
  - "AI audio transcription free 2026"
  - "best AI tools for freelancers 2026"
  - "AI automation tools free 2026"
  - "new generative AI tools 2026"
  - "open source AI tools 2026"
```

- [ ] **Step 2: Create `agent/requirements.txt`**

```
google-generativeai==0.8.3
supabase==2.10.0
requests==2.32.3
python-slugify==8.0.4
pyyaml==6.0.2
```

- [ ] **Step 3: Create empty `agent/tests/__init__.py`**

Touch the file (empty content).

- [ ] **Step 4: Commit**

```bash
git add agent/queries.yaml agent/requirements.txt agent/tests/__init__.py
git commit -m "feat(agent): add query config and Python requirements"
```

---

## Task 2: Pure Helper Functions (TDD)

These functions have no external dependencies — they're pure logic or use `urllib` only. Test them first.

**Files:**
- Create: `agent/tests/test_discover_tools.py`
- Create: `agent/discover_tools.py` (helpers only, no main function yet)

- [ ] **Step 1: Write the failing tests**

Create `agent/tests/test_discover_tools.py`:

```python
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch

import pytest

from discover_tools import (
    extract_domain,
    fetch_page_text,
    is_blocked_domain,
    is_name_similar,
    parse_gemini_response,
)


class TestExtractDomain:
    def test_full_url(self):
        assert extract_domain("https://openai.com/chatgpt") == "openai.com"

    def test_strips_www(self):
        assert extract_domain("https://www.notion.so") == "notion.so"

    def test_no_scheme(self):
        assert extract_domain("anthropic.com") == "anthropic.com"

    def test_subdomain_kept(self):
        assert extract_domain("https://api.openai.com") == "api.openai.com"

    def test_empty_string(self):
        assert extract_domain("") == ""


class TestIsBlockedDomain:
    def test_medium_blocked(self):
        assert is_blocked_domain("https://medium.com/some-article") is True

    def test_producthunt_blocked(self):
        assert is_blocked_domain("https://www.producthunt.com/posts/sometool") is True

    def test_allowed_tool(self):
        assert is_blocked_domain("https://cursor.sh") is False

    def test_perplexity_allowed(self):
        assert is_blocked_domain("https://perplexity.ai") is False


class TestIsNameSimilar:
    def test_identical_name(self):
        assert is_name_similar("ChatGPT", ["ChatGPT", "Claude"]) is True

    def test_no_overlap(self):
        assert is_name_similar("Runway ML", ["ChatGPT", "Perplexity"]) is False

    def test_two_shared_words_not_enough(self):
        # "AI Writing Tool" vs "AI Writing Assistant" → 2 shared words < threshold=3
        assert is_name_similar("AI Writing Tool", ["AI Writing Assistant"]) is False

    def test_three_shared_words_match(self):
        # "OpenAI ChatGPT Plus" vs "OpenAI ChatGPT Free" → 3 shared >= 3
        assert is_name_similar("OpenAI ChatGPT Plus", ["OpenAI ChatGPT Free"]) is True

    def test_empty_existing_list(self):
        assert is_name_similar("Some Tool", []) is False


class TestParseGeminiResponse:
    def test_valid_json_object(self):
        data = {"is_ai_tool": True, "name": "TestTool"}
        assert parse_gemini_response(json.dumps(data)) == data

    def test_strips_json_code_fence(self):
        text = '```json\n{"is_ai_tool": false, "skip_reason": "blog"}\n```'
        result = parse_gemini_response(text)
        assert result == {"is_ai_tool": False, "skip_reason": "blog"}

    def test_strips_plain_code_fence(self):
        text = '```\n{"is_ai_tool": true}\n```'
        result = parse_gemini_response(text)
        assert result == {"is_ai_tool": True}

    def test_invalid_json_returns_none(self):
        assert parse_gemini_response("not valid json") is None

    def test_empty_string_returns_none(self):
        assert parse_gemini_response("") is None


class TestFetchPageText:
    def test_returns_text_on_success(self):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b"Hello world page content"
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = fetch_page_text("https://example.com", max_chars=100)

        assert "Hello world" in result

    def test_returns_empty_string_on_network_error(self):
        with patch("urllib.request.urlopen", side_effect=Exception("timeout")):
            result = fetch_page_text("https://example.com")

        assert result == ""

    def test_truncates_to_max_chars(self):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b"A" * 10000
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = fetch_page_text("https://example.com", max_chars=50)

        assert len(result) == 50
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd /path/to/repo
pip install pytest
cd agent
python -m pytest tests/test_discover_tools.py -v
```

Expected: `ModuleNotFoundError: No module named 'discover_tools'` — that's correct, the module doesn't exist yet.

- [ ] **Step 3: Create `agent/discover_tools.py` with helper functions only**

```python
#!/usr/bin/env python3
"""Automated AI tool discovery agent."""

import json
import logging
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
import yaml
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DOMAIN_BLOCKLIST = frozenset({
    "medium.com", "producthunt.com", "reddit.com", "forbes.com",
    "techcrunch.com", "venturebeat.com", "theverge.com", "wired.com",
    "towardsdatascience.com", "news.ycombinator.com",
    "mashable.com", "zdnet.com", "cnet.com",
})

MAX_CANDIDATES = 15
MAX_NEW_TOOLS = 10


def extract_domain(url: str) -> str:
    """Return the registered domain (e.g. 'openai.com') from a URL."""
    try:
        parsed = urlparse(url if url.startswith("http") else "https://" + url)
        host = parsed.hostname or ""
        return host.removeprefix("www.")
    except Exception:
        return ""


def is_blocked_domain(url: str) -> bool:
    """True if the URL's domain is on the blocklist."""
    return extract_domain(url) in DOMAIN_BLOCKLIST


def is_name_similar(name: str, existing_names: list[str], threshold: int = 3) -> bool:
    """True if `name` shares `threshold`+ words with any existing tool name."""
    name_words = set(name.lower().split())
    for existing in existing_names:
        if len(name_words & set(existing.lower().split())) >= threshold:
            return True
    return False


def fetch_page_text(url: str, max_chars: int = 3000, timeout: int = 5) -> str:
    """Fetch a URL and return the first max_chars of decoded text."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AIToolsBot/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(max_chars * 4)
            text = raw.decode("utf-8", errors="ignore")
            return text[:max_chars]
    except Exception as exc:
        log.warning("fetch_page_text(%s): %s", url, exc)
        return ""


def parse_gemini_response(text: str) -> Optional[dict]:
    """Parse Gemini's JSON output. Strips markdown fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner)
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Failed to parse Gemini JSON: %r", text[:200])
        return None
```

- [ ] **Step 4: Install dependencies and run tests — verify they pass**

```bash
pip install -r agent/requirements.txt pytest
cd agent
python -m pytest tests/test_discover_tools.py -v
```

Expected output (all pass):
```
test_discover_tools.py::TestExtractDomain::test_full_url PASSED
test_discover_tools.py::TestExtractDomain::test_strips_www PASSED
test_discover_tools.py::TestExtractDomain::test_no_scheme PASSED
test_discover_tools.py::TestExtractDomain::test_subdomain_kept PASSED
test_discover_tools.py::TestExtractDomain::test_empty_string PASSED
test_discover_tools.py::TestIsBlockedDomain::test_medium_blocked PASSED
test_discover_tools.py::TestIsBlockedDomain::test_producthunt_blocked PASSED
test_discover_tools.py::TestIsBlockedDomain::test_allowed_tool PASSED
test_discover_tools.py::TestIsBlockedDomain::test_perplexity_allowed PASSED
test_discover_tools.py::TestIsNameSimilar::test_identical_name PASSED
test_discover_tools.py::TestIsNameSimilar::test_no_overlap PASSED
test_discover_tools.py::TestIsNameSimilar::test_two_shared_words_not_enough PASSED
test_discover_tools.py::TestIsNameSimilar::test_three_shared_words_match PASSED
test_discover_tools.py::TestIsNameSimilar::test_empty_existing_list PASSED
test_discover_tools.py::TestParseGeminiResponse::test_valid_json_object PASSED
test_discover_tools.py::TestParseGeminiResponse::test_strips_json_code_fence PASSED
test_discover_tools.py::TestParseGeminiResponse::test_strips_plain_code_fence PASSED
test_discover_tools.py::TestParseGeminiResponse::test_invalid_json_returns_none PASSED
test_discover_tools.py::TestParseGeminiResponse::test_empty_string_returns_none PASSED
test_discover_tools.py::TestFetchPageText::test_returns_text_on_success PASSED
test_discover_tools.py::TestFetchPageText::test_returns_empty_string_on_network_error PASSED
test_discover_tools.py::TestFetchPageText::test_truncates_to_max_chars PASSED

22 passed in 0.XXs
```

- [ ] **Step 5: Commit**

```bash
git add agent/discover_tools.py agent/tests/test_discover_tools.py
git commit -m "feat(agent): add helper functions with tests (TDD)"
```

---

## Task 3: Complete `discover_tools.py` — Integration Functions + Main

Add the four integration functions and the `main()` entry point to the existing `discover_tools.py`.

**Files:**
- Modify: `agent/discover_tools.py`

- [ ] **Step 1: Add Gemini constants and prompt template at the top of `discover_tools.py` (after imports)**

Add after the `MAX_NEW_TOOLS = 10` line:

```python
GEMINI_SYSTEM = (
    "You are an AI tool curator. Given a URL, page excerpt, and search snippet, "
    "determine if this is a real standalone AI-powered tool (not a blog post, "
    "listicle, or company homepage for a non-AI business). If it is, extract "
    "structured data. Return JSON only. No explanation."
)

GEMINI_PROMPT_TEMPLATE = """\
Tool URL: {url}
Tool name from search: {title}
Search snippet: {snippet}
Page excerpt (first 3000 chars):
{page_text}

Available category IDs:
- writing-productivity
- coding-assistants
- image-video
- local-llms
- audio-voice
- research-data
- business-marketing
- education

Return this exact JSON (no markdown, no code blocks):
{{
  "is_ai_tool": true,
  "name": "Tool Name",
  "slug": "tool-name",
  "tagline": "One line tagline under 80 chars",
  "description": "2-3 sentences describing what it does and who it is for.",
  "url": "https://official-url.com",
  "category": "one-of-8-ids-above",
  "tags": ["tag1", "tag2", "tag3"],
  "pricing": "free",
  "indian_pricing": null,
  "rating": 3.8,
  "best_for_india": false,
  "free_forever": false,
  "pros": ["Pro one", "Pro two", "Pro three"],
  "cons": ["Con one", "Con two"],
  "logo_domain": "officialdomain.com"
}}

If NOT a standalone AI tool, return:
{{"is_ai_tool": false, "skip_reason": "brief reason"}}

Rating guidance: 3.5-4.2. Default 3.8. Use 4.0+ only if generous free tier or strong adoption evidence.
"""
```

Also add `import google.generativeai as genai` to the imports block.

- [ ] **Step 2: Append the four integration functions to `discover_tools.py`**

Add after `parse_gemini_response`:

```python
def search_brave(query: str, api_key: str) -> list[dict]:
    """Query Brave Search API. Returns list of {title, url, description} dicts."""
    resp = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers={"Accept": "application/json", "X-Subscription-Token": api_key},
        params={"q": query, "count": 10, "text_decorations": False},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("web", {}).get("results", [])
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "description": r.get("description", ""),
        }
        for r in results
    ]


def evaluate_with_gemini(candidate: dict, model) -> Optional[dict]:
    """
    Send a candidate to Gemini. Returns parsed tool dict or None if not an AI tool.
    Sleeps 4s after each call to stay under the 15 req/min free-tier limit.
    """
    page_text = fetch_page_text(candidate["url"])
    prompt = GEMINI_PROMPT_TEMPLATE.format(
        url=candidate["url"],
        title=candidate["title"],
        snippet=candidate["description"],
        page_text=page_text or "(page unavailable)",
    )
    try:
        response = model.generate_content(prompt)
        parsed = parse_gemini_response(response.text)
        if parsed is None or not parsed.get("is_ai_tool"):
            reason = parsed.get("skip_reason") if parsed else "parse error"
            log.info("Skip %s: %s", candidate["url"], reason)
            return None
        return parsed
    except Exception as exc:
        log.warning("Gemini error for %s: %s", candidate["url"], exc)
        return None


def write_tool_to_supabase(client, tool_data: dict) -> bool:
    """Upsert a single tool row. Returns True on success."""
    logo_domain = tool_data.pop("logo_domain", None) or extract_domain(tool_data.get("url", ""))
    row = {
        "id": tool_data["slug"],
        "name": tool_data["name"],
        "slug": tool_data["slug"],
        "tagline": tool_data.get("tagline", ""),
        "description": tool_data.get("description", ""),
        "logo": f"https://logo.clearbit.com/{logo_domain}" if logo_domain else "",
        "url": tool_data["url"],
        "affiliate_url": None,
        "category": tool_data.get("category", "writing-productivity"),
        "tags": tool_data.get("tags", []),
        "pricing": tool_data.get("pricing", "freemium"),
        "indian_pricing": tool_data.get("indian_pricing"),
        "rating": float(tool_data.get("rating", 3.8)),
        "review_count": None,
        "best_for_india": bool(tool_data.get("best_for_india", False)),
        "free_forever": bool(tool_data.get("free_forever", False)),
        "featured": False,
        "languages": [],
        "pros": tool_data.get("pros", []),
        "cons": tool_data.get("cons", []),
        "date_added": date.today().isoformat(),
        "is_active": True,
        "source": "agent",
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
        "needs_review": False,
        "agent_notes": None,
    }
    try:
        client.table("tools").upsert(row, on_conflict="slug").execute()
        log.info("Upserted: %s (%s)", row["name"], row["slug"])
        return True
    except Exception as exc:
        log.error("Supabase write failed for %s: %s", row["slug"], exc)
        return False


def trigger_vercel_rebuild(webhook_url: str) -> None:
    """POST to the Vercel deploy webhook to trigger a site rebuild."""
    try:
        requests.post(webhook_url, timeout=10)
        log.info("Triggered Vercel rebuild")
    except Exception as exc:
        log.warning("Vercel webhook failed: %s", exc)
```

- [ ] **Step 3: Append the `run_discovery` orchestrator and `main` to `discover_tools.py`**

```python
def run_discovery(
    queries: list[str],
    brave_key: str,
    gemini_model,
    supabase_client,
    webhook_url: str,
) -> int:
    """Full pipeline. Returns count of new tools added."""
    # Load existing tools for deduplication
    existing = supabase_client.table("tools").select("url,name").execute()
    existing_domains = {extract_domain(r["url"]) for r in existing.data}
    existing_names = [r["name"] for r in existing.data]

    # Search
    raw: list[dict] = []
    for query in queries:
        try:
            raw.extend(search_brave(query, brave_key))
        except Exception as exc:
            log.warning("Brave search failed %r: %s", query, exc)
        time.sleep(1)

    # Deduplicate and filter
    seen: set[str] = set()
    candidates: list[dict] = []
    for c in raw:
        domain = extract_domain(c["url"])
        if (
            not domain
            or is_blocked_domain(c["url"])
            or domain in existing_domains
            or domain in seen
            or is_name_similar(c["title"], existing_names)
        ):
            continue
        seen.add(domain)
        candidates.append(c)
        if len(candidates) >= MAX_CANDIDATES:
            break

    log.info("%d raw → %d candidates", len(raw), len(candidates))

    # Evaluate and write
    new_count = 0
    for candidate in candidates:
        if new_count >= MAX_NEW_TOOLS:
            break
        tool_data = evaluate_with_gemini(candidate, gemini_model)
        if tool_data and write_tool_to_supabase(supabase_client, tool_data):
            new_count += 1
        time.sleep(4)

    log.info("Added %d new tools", new_count)

    if new_count > 0:
        trigger_vercel_rebuild(webhook_url)
    else:
        log.info("No new tools — skipping rebuild")

    return new_count


def main() -> None:
    queries_path = os.path.join(os.path.dirname(__file__), "queries.yaml")
    with open(queries_path) as f:
        all_queries = yaml.safe_load(f)

    day = datetime.now(timezone.utc).strftime("%A").lower()  # "monday", "thursday", etc.
    queries = all_queries.get(day, all_queries.get("monday", []))
    log.info("Running %d queries for %s", len(queries), day)

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    gemini_model = genai.GenerativeModel(
        "gemini-1.5-flash",
        system_instruction=GEMINI_SYSTEM,
    )
    supabase_client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    run_discovery(
        queries=queries,
        brave_key=os.environ["BRAVE_API_KEY"],
        gemini_model=gemini_model,
        supabase_client=supabase_client,
        webhook_url=os.environ["VERCEL_DEPLOY_HOOK_URL"],
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the existing tests — verify they still all pass**

```bash
cd agent
python -m pytest tests/test_discover_tools.py -v
```

Expected: 22 passed (same as before — helpers unchanged).

- [ ] **Step 5: Commit**

```bash
git add agent/discover_tools.py
git commit -m "feat(agent): add Brave/Gemini/Supabase integration and main pipeline"
```

---

## Task 4: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/tool-discovery.yml`

- [ ] **Step 1: Create the workflows directory if it doesn't exist**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/tool-discovery.yml`**

```yaml
name: AI Tool Discovery

on:
  schedule:
    # Monday and Thursday at midnight UTC
    - cron: '0 0 * * 1,4'
  workflow_dispatch:    # allows manual runs from GitHub Actions UI for testing

jobs:
  discover:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: agent/requirements.txt

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

- [ ] **Step 3: Validate the YAML is syntactically correct**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/tool-discovery.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/tool-discovery.yml
git commit -m "feat(agent): add GitHub Actions cron workflow (Mon+Thu midnight UTC)"
```

---

## Task 5: GitHub Secrets Setup + Manual Test

This task is manual steps in the GitHub and API provider UIs. No code.

**Required secrets to add in GitHub → Repository Settings → Secrets and variables → Actions → New repository secret:**

| Secret name | Where to get the value |
|---|---|
| `BRAVE_API_KEY` | Go to `api.search.brave.com` → Sign up free → Create application → Copy API key |
| `GEMINI_API_KEY` | Go to `aistudio.google.com` → Get API key → Create API key → Free tier |
| `SUPABASE_URL` | Supabase dashboard → Project → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project → Settings → API → `service_role` key (⚠️ keep secret — bypasses RLS) |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel dashboard → Project → Settings → Git → Deploy Hooks → Create hook → Copy URL |

- [ ] **Step 1: Add all 5 secrets in GitHub Actions settings**

Go to: `github.com/<your-org>/<your-repo>/settings/secrets/actions`

Add each secret listed above.

- [ ] **Step 2: Push the branch to GitHub**

```bash
git push origin main
```

(Or whatever branch you're on — the workflow runs on any branch it's checked out from when triggered via `workflow_dispatch`.)

- [ ] **Step 3: Trigger a manual test run**

Go to: `github.com/<your-org>/<your-repo>/actions/workflows/tool-discovery.yml`

Click **Run workflow** → **Run workflow** (uses `main` branch).

- [ ] **Step 4: Watch the run logs**

In the Actions tab, click the running workflow. Expand the "Run discovery agent" step.

Expected log output (example):
```
2026-05-31 00:00:01 INFO Running 8 queries for sunday
2026-05-31 00:00:15 INFO 80 raw → 12 candidates
2026-05-31 00:00:19 INFO Skip https://some-blog.com: not an AI tool
2026-05-31 00:00:24 INFO Upserted: ToolName (tool-name)
2026-05-31 00:00:45 INFO Added 3 new tools
2026-05-31 00:00:46 INFO Triggered Vercel rebuild
```

If the run uses `workflow_dispatch` on a day that's not in `queries.yaml`, it falls back to `monday` queries — this is expected.

- [ ] **Step 5: Verify in Supabase**

Open Supabase → Table Editor → `tools` table. Filter by `source = 'agent'`. New rows should appear.

- [ ] **Step 6: Verify Vercel rebuild (if tools were added)**

Check Vercel dashboard → Deployments. A new deployment should be in progress or completed within ~1 minute of the workflow finishing.

---

## Quota Reference (for monitoring)

| API | Free limit | Our usage | Check at |
|---|---|---|---|
| Brave Search | 2,000 req/month | ~64/month | api.search.brave.com → Usage |
| Gemini 1.5 Flash | 1,500 req/day | ~15/run | aistudio.google.com → API usage |
| GitHub Actions | Unlimited (public repo) | ~5 min/run | GitHub → Actions → Usage |
| Supabase | 500MB storage, unlimited rows | negligible | Supabase → Settings → Usage |
| Vercel | 100 deploys/day | 1/run | Vercel → Settings → Usage |
