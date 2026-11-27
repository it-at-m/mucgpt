from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from agent.tools import tool_metadata

headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.mark.integration
def test_tools_list(test_client: TestClient):
    """Test the /v1/tools endpoint returns tool metadata."""
    response = test_client.get("/v1/tools", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    assert isinstance(data["tools"], list)
    assert data["tools"]
    assert all(
        "name" in tool and "description" in tool and "mcp_group" in tool
        for tool in data["tools"]
    )


@pytest.mark.integration
def test_tools_list_includes_loaded_mcp_tool(
    test_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    loader = AsyncMock(
        return_value=[
            SimpleNamespace(
                name="documents__search",
                description="Search approved documents",
                metadata={"mcp_source": "documents", "mcp_group": "knowledge"},
            )
        ]
    )
    monkeypatch.setattr(tool_metadata.McpLoader, "load_mcp_tools", loader)

    response = test_client.get(
        "/v1/tools?lang=english&force_reload=true", headers=headers
    )

    assert response.status_code == 200
    documents_tool = next(
        tool for tool in response.json()["tools"] if tool["id"] == "documents__search"
    )
    assert documents_tool == {
        "id": "documents__search",
        "name": "documents__search",
        "description": "Search approved documents",
        "mcp_source": "documents",
        "mcp_scope": "knowledge",
        "mcp_group": "knowledge",
    }
    assert loader.await_args is not None
    assert loader.await_args.kwargs["force_reload"] is True
