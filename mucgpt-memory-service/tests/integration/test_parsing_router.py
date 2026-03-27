import io
from unittest.mock import AsyncMock, patch

import pytest

PARSED_RESULT = {"content": "Hello from parsed file", "metadata": {"pages": 1}}


@pytest.mark.integration
@patch("api.routers.parsing_router._parser")
def test_parse_file_returns_uuid(mock_parser, test_client):
    """POST /parse/ should call the parser backend and return a UUID string."""
    mock_parser.parse = AsyncMock(return_value=PARSED_RESULT)

    response = test_client.post(
        "/parse/",
        files={
            "file": (
                "test.pdf",
                io.BytesIO(b"%PDF-1.4 test content"),
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200
    file_id = response.json()
    assert isinstance(file_id, str) and len(file_id) == 36  # UUID format
    mock_parser.parse.assert_awaited_once()


@pytest.mark.integration
@patch("api.routers.parsing_router._parser")
def test_parse_file_stores_result(mock_parser, test_client):
    """Parsed result should be retrievable by the returned UUID."""
    import api.routers.parsing_router as pr

    mock_parser.parse = AsyncMock(return_value=PARSED_RESULT)

    response = test_client.post(
        "/parse/",
        files={"file": ("doc.txt", io.BytesIO(b"some text"), "text/plain")},
    )

    file_id = response.json()
    assert file_id in pr.file_storage
    assert pr.file_storage[file_id] == PARSED_RESULT


@pytest.mark.integration
@patch("api.routers.parsing_router._parser")
def test_parse_file_backend_error_propagates(mock_parser, test_client):
    """A backend HTTP error should surface as a 500."""
    import httpx

    mock_parser.parse = AsyncMock(
        side_effect=httpx.HTTPStatusError(
            "upstream error",
            request=httpx.Request("POST", "http://test"),
            response=httpx.Response(503),
        )
    )

    response = test_client.post(
        "/parse/",
        files={"file": ("fail.pdf", io.BytesIO(b"data"), "application/pdf")},
    )

    assert response.status_code == 500
