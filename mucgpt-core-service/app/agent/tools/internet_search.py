import logging
import textwrap
from typing import Any
from urllib.parse import urljoin

import httpx
from langchain_core.tools import tool
from langchain_core.tools.base import BaseTool
from langgraph.config import get_stream_writer
from langgraph.types import StreamWriter

from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from config.settings import InternetSearchConfig, get_internet_search_settings

INTERNET_SEARCH_SUMMARY = "Searches the internet via the configured SearXNG engine and returns sourced results."

INTERNET_SEARCH_DETAILED = textwrap.dedent(
    """
    **InternetSearch**

    Description: Searches the internet through the configured SearXNG instance and returns titles, URLs and snippets.

    Use for:
    - Current or time-sensitive information
    - External facts not available in the conversation
    - Finding source URLs for claims

    Parameters:
    - query (required) Search query
    - max_results (optional) Number of results to return, capped by server configuration
    - language (optional) Search language code, for example "de" or "en"

    Best Practices:
    - Use specific queries with names, dates or domains when helpful.
    - Cite the returned URLs in the final answer when using search results.
    - If results are empty or weak, say so instead of inventing facts.
    """
)


def is_internet_search_configured(settings: InternetSearchConfig | None = None) -> bool:
    settings = settings or get_internet_search_settings()
    url = settings.SEARXNG_URL.strip()
    return bool(url) and not (url.startswith("<") and url.endswith(">"))


def _get_writer() -> StreamWriter | None:
    try:
        return get_stream_writer()
    except RuntimeError:
        return None


def _format_result(result: dict[str, Any], index: int) -> str:
    title = str(result.get("title") or "Untitled result").strip()
    url = str(result.get("url") or "").strip()
    snippet = str(
        result.get("content")
        or result.get("snippet")
        or result.get("description")
        or ""
    ).strip()

    lines = [f"{index}. {title}"]
    if url:
        lines.append(f"URL: {url}")
    if snippet:
        lines.append(f"Snippet: {snippet}")
    return "\n".join(lines)


def internet_search(
    query: str,
    logger: logging.Logger,
    max_results: int | None = None,
    language: str | None = None,
    writer: StreamWriter | None = None,
) -> str:
    """Search the internet through a configured SearXNG JSON endpoint."""
    settings = get_internet_search_settings()
    if not is_internet_search_configured(settings):
        return (
            "Internet search is not configured. Set "
            "INTERNET_SEARCH.SEARXNG_URL or MUCGPT_CORE_INTERNET_SEARCH__SEARXNG_URL."
        )

    clean_query = (query or "").strip()
    if not clean_query:
        return "Error: query is required for internet search."

    result_limit = settings.MAX_RESULTS
    if max_results is not None:
        result_limit = max(1, min(int(max_results), settings.MAX_RESULTS))

    search_url = urljoin(settings.SEARXNG_URL.rstrip("/") + "/", "search")
    params = {
        "q": clean_query,
        "format": "json",
        "language": language or settings.LANGUAGE,
        "safesearch": settings.SAFESEARCH,
    }

    try:
        if writer:
            writer(
                ToolStreamChunk(
                    state=ToolStreamState.STARTED,
                    content=f"Suche im Internet nach: {clean_query}",
                    tool_name="InternetSearch",
                ).model_dump_json()
            )

        with httpx.Client(timeout=settings.TIMEOUT) as client:
            response = client.get(search_url, params=params)
            response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException:
        logger.warning("Internet search timed out for query=%s", clean_query)
        return "Internet search timed out."
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Internet search failed with status=%s query=%s",
            exc.response.status_code,
            clean_query,
        )
        return f"Internet search failed with status {exc.response.status_code}."
    except httpx.RequestError as exc:
        logger.warning(
            "Internet search request failed for query=%s: %s", clean_query, exc
        )
        return f"Internet search request failed: {exc}"
    except ValueError:
        logger.warning(
            "Internet search returned invalid JSON for query=%s", clean_query
        )
        return "Internet search returned invalid JSON."

    raw_results = payload.get("results", []) if isinstance(payload, dict) else []
    results = [result for result in raw_results if isinstance(result, dict)][
        :result_limit
    ]
    if not results:
        return f"No internet search results found for '{clean_query}'."

    formatted_results = "\n\n".join(
        _format_result(result, index) for index, result in enumerate(results, start=1)
    )
    return f"Internet search results for '{clean_query}':\n\n{formatted_results}"


def make_internet_search_tool(logger: logging.Logger) -> BaseTool:
    @tool("InternetSearch", description=INTERNET_SEARCH_SUMMARY)
    def internet_search_tool(
        query: str,
        max_results: int | None = None,
        language: str | None = None,
    ):
        writer = _get_writer()
        result = internet_search(
            query=query,
            logger=logger,
            max_results=max_results,
            language=language,
            writer=writer,
        )
        if writer:
            writer(
                ToolStreamChunk(
                    state=ToolStreamState.ENDED,
                    content="Internetsuche abgeschlossen.",
                    tool_name="InternetSearch",
                ).model_dump_json()
            )
        return result

    internet_search_tool.metadata = {"mcp_group": "default"}
    return internet_search_tool
