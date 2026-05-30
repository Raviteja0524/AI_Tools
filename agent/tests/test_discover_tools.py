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

    def test_subdomain_of_blocked_domain(self):
        assert is_blocked_domain("https://blog.medium.com/article") is True


class TestIsNameSimilar:
    def test_identical_name(self):
        assert is_name_similar("ChatGPT", ["ChatGPT", "Claude"]) is True

    def test_no_overlap(self):
        assert is_name_similar("Runway ML", ["ChatGPT", "Perplexity"]) is False

    def test_two_shared_words_not_enough(self):
        # After filtering short/generic tokens ("ai" removed), only "writing" is shared
        # — 1 meaningful word < effective threshold of 2, so not similar
        assert is_name_similar("AI Writing Tool", ["AI Writing Assistant"]) is False

    def test_three_shared_words_match(self):
        # After filtering generic tokens ("plus"/"free" removed), "openai" and "chatgpt"
        # are shared — 2 meaningful words >= effective threshold of 2, so similar
        assert is_name_similar("OpenAI ChatGPT Plus", ["OpenAI ChatGPT Free"]) is True

    def test_empty_existing_list(self):
        assert is_name_similar("Some Tool", []) is False

    def test_generic_tokens_do_not_trigger_similarity(self):
        # "AI Tool" and "AI Tool Kit" share only generic tokens that are filtered out
        # — no meaningful overlap, so not similar
        assert is_name_similar("AI Tool", ["AI Tool Kit"]) is False


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
