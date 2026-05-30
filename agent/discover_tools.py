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
