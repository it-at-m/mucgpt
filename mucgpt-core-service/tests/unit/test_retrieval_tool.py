from typing import Any
from unittest.mock import MagicMock

from agent.tools import tools
from config.settings import RetrievalConfig


class FakeResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {
            "retrieval_documents": [
                {
                    "name": "Doc title",
                    "url": "https://example.com/doc",
                    "metadata": {"page": 1},
                    "page_content": "Doc content",
                },
                {
                    "name": "Second doc",
                    "url": "https://example.com/doc2",
                    "metadata": {"page": 2},
                    "page_content": "Second content",
                },
            ]
        }


class FakeClient:
    last_url = None
    last_json = None

    def __init__(self, timeout: Any) -> None:
        self.timeout = timeout

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *args: Any) -> None:
        return None

    def post(self, url: str, json: dict[str, Any], headers: dict[str, Any]) -> FakeResponse:
        FakeClient.last_url = url
        FakeClient.last_json = json
        return FakeResponse()


def test_retrieval_placeholder_is_not_configured() -> None:
    settings = RetrievalConfig(API_URL="<your-retrieval-url>")

    assert tools.is_retrieval_configured(settings) is False


def test_retrieval_empty_url_is_not_configured() -> None:
    assert tools.is_retrieval_configured(RetrievalConfig()) is False


def test_retrieval_configured_when_url_set() -> None:
    settings = RetrievalConfig(API_URL="https://retrieval-test.muenchen.de/api/retrieval")

    assert tools.is_retrieval_configured(settings) is True


def test_make_retrieval_tool_returns_formatted_documents(monkeypatch: Any) -> None:
    settings = RetrievalConfig(
        API_URL="https://retrieval-test.muenchen.de/api/retrieval",
        MAX_RESULTS=4,
        COLLECTIONS=["ki_pm_documents_3072"],
    )
    monkeypatch.setattr(tools, "get_retrieval_settings", lambda: settings)
    monkeypatch.setattr(tools, "Client", FakeClient)

    tool = tools.make_retrieval_tool(MagicMock())
    result = tool.invoke({"query": "test query", "max_results": 1})

    assert "Doc title" in result
    assert "https://example.com/doc" in result
    assert "Second doc" not in result  # max_results=1 clamp is respected
    assert FakeClient.last_url == "https://retrieval-test.muenchen.de/api/retrieval"
    assert FakeClient.last_json["query"] == "test query"
    assert FakeClient.last_json["collections"] == ["ki_pm_documents_3072"]


def test_make_retrieval_tool_has_default_name() -> None:
    tool = tools.make_retrieval_tool(MagicMock())

    assert tool.name == "RetrievePMDocs"
