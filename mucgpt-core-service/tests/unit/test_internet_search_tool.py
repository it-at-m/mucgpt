from typing import Any
from unittest.mock import MagicMock

from agent.tools import internet_search
from config.settings import InternetSearchConfig


class FakeResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {
            "results": [
                {
                    "title": "Result title",
                    "url": "https://example.com/result",
                    "content": "Result snippet",
                }
            ]
        }


class FakeClient:
    last_url = None
    last_params = None

    def __init__(self, timeout: Any) -> None:
        self.timeout = timeout

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *args: Any) -> None:
        return None

    def get(self, url: str, params: dict[str, Any]) -> FakeResponse:
        FakeClient.last_url = url
        FakeClient.last_params = params
        return FakeResponse()


def test_internet_search_placeholder_is_not_configured() -> None:
    settings = InternetSearchConfig(SEARXNG_URL="<your-searxng-url>")

    assert internet_search.is_internet_search_configured(settings) is False


def test_internet_search_returns_sourced_results(monkeypatch: Any) -> None:
    settings = InternetSearchConfig(
        SEARXNG_URL="https://searxng-test.muenchen.de/",
        MAX_RESULTS=3,
        LANGUAGE="de",
    )
    monkeypatch.setattr(
        internet_search, "get_internet_search_settings", lambda: settings
    )
    monkeypatch.setattr(internet_search.httpx, "Client", FakeClient)

    result = internet_search.internet_search(
        query="test query",
        logger=MagicMock(),
        max_results=1,
    )

    assert "Internet search results for 'test query'" in result
    assert "Result title" in result
    assert "https://example.com/result" in result
    assert FakeClient.last_url == "https://searxng-test.muenchen.de/search"
    assert FakeClient.last_params == {
        "q": "test query",
        "format": "json",
        "language": "de",
        "safesearch": 1,
    }


def test_make_internet_search_tool_has_default_metadata() -> None:
    tool = internet_search.make_internet_search_tool(MagicMock())

    assert tool.name == "InternetSearch"
    assert tool.metadata == {"mcp_group": "default"}
