"""
Live disruption news monitoring for a supply-chain component.

Two-step pipeline, each step using a different free API so neither becomes
a bottleneck:
  1. Tavily (https://tavily.com) does the actual live web search — built for
     AI agents, with a much more generous free tier than Gemini's built-in
     search grounding.
  2. Gemini (plain text call, NO search tool attached) reads Tavily's results
     and turns them into the structured JSON this app needs.

Requires TAVILY_API_KEY and GEMINI_API_KEY in backend/.env.
"""
import json
import re
from datetime import date

import httpx

from app.config import settings

TAVILY_API_URL = "https://api.tavily.com/search"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MODEL = "gemini-3.8-flash"


class NewsMonitorError(Exception):
    pass


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _search_tavily(query: str) -> list[dict]:
    api_key = settings.tavily_api_key
    if not api_key:
        raise NewsMonitorError(
            "TAVILY_API_KEY is not set — live news search needs it. Add it to backend/.env "
            "(get a free key at https://tavily.com)"
        )

    response = httpx.post(
        TAVILY_API_URL,
        json={
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5,
            "days": 90,
            "include_answer": False,
        },
        timeout=30.0,
    )
    if response.status_code != 200:
        raise NewsMonitorError(f"Tavily API error {response.status_code}: {response.text[:400]}")

    data = response.json()
    return data.get("results", [])


def _synthesize_with_gemini(component_name: str, search_results: list[dict]) -> dict:
    api_key = settings.gemini_api_key
    if not api_key:
        raise NewsMonitorError(
            "GEMINI_API_KEY is not set — add it to backend/.env (get a free key at "
            "https://aistudio.google.com/apikey)"
        )

    if not search_results:
        results_text = "(no search results found)"
    else:
        results_text = "\n\n".join(
            f"- {r.get('title', '')}\n  URL: {r.get('url', '')}\n  {r.get('content', '')[:400]}"
            for r in search_results
        )

    prompt = f"""Here are web search results about potential supply disruptions affecting "{component_name}":

{results_text}

Based ONLY on these results, assess whether there's a real supply disruption (export ban,
tariff, factory shutdown, shortage) affecting this component. Respond with ONLY a JSON
object, no other text, no markdown fences:
{{
  "disruption_found": true or false,
  "disruption_type": "export_ban" or "tariff" or "shortage" or "factory_disruption" or "none",
  "headline": "one sentence summary of the most relevant finding, or empty string if none",
  "source_url": "URL of the most relevant source, or null",
  "estimated_delay_days": integer estimate of added lead time this could cause (0 if none found),
  "confidence": number between 0 and 1
}}"""

    response = httpx.post(
        GEMINI_API_URL.format(model=MODEL),
        params={"key": api_key},
        headers={"content-type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=60.0,
    )
    if response.status_code != 200:
        raise NewsMonitorError(f"Gemini API error {response.status_code}: {response.text[:400]}")
    data = response.json()

    try:
        candidate = data["candidates"][0]
        parts = candidate.get("content", {}).get("parts", [])
        full_text = "\n".join(p["text"] for p in parts if "text" in p)
    except (KeyError, IndexError) as e:
        raise NewsMonitorError(f"Unexpected Gemini response shape: {e}\nRaw: {json.dumps(data)[:500]}")

    try:
        return _extract_json(full_text)
    except (json.JSONDecodeError, ValueError) as e:
        raise NewsMonitorError(f"Could not parse model response as JSON: {e}\nRaw: {full_text[:500]}")


def check_component_news(component_name: str, source_region: str | None, category: str | None) -> dict:
    """
    Searches for current supply-disruption news relevant to a component (via
    Tavily) and returns a structured assessment (via a plain Gemini call).
    """
    region_str = f" {source_region}" if source_region else ""
    query = f"{component_name}{region_str} export ban tariff shortage supply disruption news"

    search_results = _search_tavily(query)
    result = _synthesize_with_gemini(component_name, search_results)

    result.setdefault("disruption_found", False)
    result.setdefault("disruption_type", "none")
    result.setdefault("headline", "")
    result.setdefault("source_url", None)
    result.setdefault("estimated_delay_days", 0)
    result.setdefault("confidence", 0.5)
    result["checked_at"] = date.today().isoformat()
    return result