#!/usr/bin/env python3
"""Automated AI tool discovery agent."""

import json
import logging
import os
import time
import urllib.request
from datetime import date, datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
import yaml
from groq import Groq
from tavily import TavilyClient
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

SYSTEM_PROMPT = (
    "You are an AI tool curator. Given a URL, page excerpt, and search snippet, "
    "determine if this is a real standalone AI-powered tool (not a blog post, "
    "listicle, or company homepage for a non-AI business). If it is, extract "
    "structured data. Return JSON only. No explanation."
)

PROMPT_TEMPLATE = """\
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


def extract_domain(url: str) -> str:
    """Return the registered domain (e.g. 'openai.com') from a URL."""
    try:
        parsed = urlparse(url if url.startswith("http") else "https://" + url)
        host = parsed.hostname or ""
        return host.removeprefix("www.")
    except Exception:
        return ""


def is_blocked_domain(url: str) -> bool:
    """True if the URL's domain (or a parent domain) is on the blocklist."""
    domain = extract_domain(url)
    if domain in DOMAIN_BLOCKLIST:
        return True
    return any(domain.endswith("." + blocked) for blocked in DOMAIN_BLOCKLIST)


_SHORT_WORDS = frozenset({
    "ai", "ml", "ar", "vr", "io", "ui", "ux", "it",  # 2-char
    "llm", "gpt", "api", "app", "new", "best", "top", "pro", "free",  # 3-char
    "tool", "tools", "plus", "lite", "open",  # 4-char
})


def is_name_similar(name: str, existing_names: list[str], threshold: int = 3) -> bool:
    """True if `name` shares `threshold`+ meaningful words with any existing tool name,
    or if `name` exactly matches any existing name (case-insensitive).

    Short generic tokens (≤2 chars or in _SHORT_WORDS) are excluded from the
    word-overlap count so that names sharing only 'AI' or 'ML' are not flagged.
    The effective default threshold for meaningful-word overlap is therefore 2
    (the caller may pass threshold=3 which becomes 2 after excluding short words).
    """
    name_lower = name.lower()
    # Exact match fast-path
    for existing in existing_names:
        if name_lower == existing.lower():
            return True

    # Meaningful-word overlap: ignore short generic tokens
    def meaningful(words: set[str]) -> set[str]:
        return {w for w in words if len(w) > 2 and w not in _SHORT_WORDS}

    name_words = meaningful(set(name_lower.split()))
    # Effective threshold is threshold-1 because we strip short tokens
    effective = max(1, threshold - 1)
    for existing in existing_names:
        existing_words = meaningful(set(existing.lower().split()))
        if len(name_words & existing_words) >= effective:
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


def parse_llm_response(text: str) -> Optional[dict]:
    """Parse LLM JSON output. Strips markdown fences if present."""
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
        log.warning("Failed to parse LLM JSON: %r", text[:200])
        return None


def search_tavily(query: str, api_key: str) -> list[dict]:
    """Query Tavily Search API. Returns list of {title, url, description} dicts."""
    client = TavilyClient(api_key=api_key)
    resp = client.search(query, max_results=10)
    results = resp.get("results", [])
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "description": r.get("content", ""),
        }
        for r in results
    ]


def evaluate_with_groq(candidate: dict, client) -> Optional[dict]:
    """Send a candidate to Groq. Returns parsed tool dict or None if not an AI tool."""
    page_text = fetch_page_text(candidate["url"], max_chars=1500)
    prompt = PROMPT_TEMPLATE.format(
        url=candidate["url"],
        title=candidate["title"],
        snippet=candidate["description"],
        page_text=page_text or "(page unavailable)",
    )
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        time.sleep(2)  # stay under 30 req/min free-tier limit
        text = response.choices[0].message.content
        parsed = parse_llm_response(text)
        if parsed is None or not parsed.get("is_ai_tool"):
            reason = parsed.get("skip_reason") if parsed else "parse error"
            log.info("Skip %s: %s", candidate["url"], reason)
            return None
        return parsed
    except Exception as exc:
        log.warning("Groq error for %s: %s", candidate["url"], exc)
        return None


def write_tool_to_supabase(client, tool_data: dict) -> bool:
    """Upsert a single tool row. Returns True on success."""
    try:
        slug = tool_data.get("slug", "")
        name = tool_data.get("name", "")
        url = tool_data.get("url", "")
        if not slug or not name or not url:
            log.warning("Skipping tool with missing required fields: %r", {k: tool_data.get(k) for k in ("slug", "name", "url")})
            return False
        logo_domain = tool_data.get("logo_domain") or extract_domain(url)
        _pricing_raw = (tool_data.get("pricing") or "freemium").lower().strip()
        pricing = _pricing_raw if _pricing_raw in {"free", "freemium", "paid"} else "freemium"
        row = {
            "id": slug,
            "name": name,
            "slug": slug,
            "tagline": tool_data.get("tagline", ""),
            "description": tool_data.get("description", ""),
            "logo": f"https://logo.clearbit.com/{logo_domain}" if logo_domain else "",
            "url": url,
            "affiliate_url": None,
            "category": tool_data.get("category", "writing-productivity"),
            "tags": tool_data.get("tags", []),
            "pricing": pricing,
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
        client.table("tools").upsert(row, on_conflict="slug").execute()
        log.info("Upserted: %s (%s)", name, slug)
        return True
    except Exception as exc:
        log.error("Supabase write failed for %s: %s", tool_data.get("slug", "?"), exc)
        return False


def trigger_vercel_rebuild(webhook_url: str) -> None:
    """POST to the Vercel deploy webhook to trigger a site rebuild."""
    try:
        requests.post(webhook_url, timeout=10)
        log.info("Triggered Vercel rebuild")
    except Exception as exc:
        log.warning("Vercel webhook failed: %s", exc)


def run_discovery(
    queries: list[str],
    tavily_key: str,
    groq_client,
    supabase_client,
    webhook_url: str,
) -> int:
    """Full pipeline. Returns count of new tools added."""
    # Load existing tools for deduplication
    existing = supabase_client.table("tools").select("url,name,slug").limit(10000).execute()
    rows = existing.data or []
    existing_domains = {extract_domain(r["url"]) for r in rows}
    existing_names = [r["name"] for r in rows]
    existing_slugs = {r["slug"] for r in rows}

    # Search
    raw: list[dict] = []
    for query in queries:
        try:
            raw.extend(search_tavily(query, tavily_key))
        except Exception as exc:
            log.warning("Tavily search failed %r: %s", query, exc)
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
        tool_data = evaluate_with_groq(candidate, groq_client)
        if tool_data:
            if tool_data.get("slug") in existing_slugs:
                log.info("Skipping existing slug: %s", tool_data.get("slug"))
                continue
            if write_tool_to_supabase(supabase_client, tool_data):
                existing_slugs.add(tool_data["slug"])  # prevent duplicates within same run
                new_count += 1

    log.info("Added %d new tools", new_count)

    if new_count > 0:
        trigger_vercel_rebuild(webhook_url)
    else:
        log.info("No new tools — skipping rebuild")

    return new_count


def main() -> None:
    queries_path = os.path.join(os.path.dirname(__file__), "queries.yaml")
    try:
        with open(queries_path) as f:
            all_queries = yaml.safe_load(f)
    except (FileNotFoundError, yaml.YAMLError) as exc:
        log.error("Failed to load queries.yaml: %s", exc)
        raise SystemExit(1)

    day = datetime.now(timezone.utc).strftime("%A").lower()
    queries = all_queries.get(day, all_queries.get("monday", []))
    log.info("Running %d queries for %s", len(queries), day)

    groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
    supabase_client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    run_discovery(
        queries=queries,
        tavily_key=os.environ["TAVILY_API_KEY"],
        groq_client=groq_client,
        supabase_client=supabase_client,
        webhook_url=os.environ["VERCEL_DEPLOY_HOOK_URL"],
    )


if __name__ == "__main__":
    main()
