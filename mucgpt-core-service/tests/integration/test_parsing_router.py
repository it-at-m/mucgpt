from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend import api_app
from config.settings import ParserBackendType

headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.fixture
def unauthenticated_client():
    """Test client without any auth override — real auth dependency runs."""
    client = TestClient(api_app)
    yield client
    api_app.dependency_overrides.clear()


@pytest.mark.integration
class TestParsingRouter:
    def test_parse_disabled_returns_503(self, test_client: TestClient):
        """When PARSER_BACKEND is NONE, the endpoint should return 503."""
        with patch("api.routers.parsing_router.settings") as mock_settings:
            mock_settings.PARSER_BACKEND = ParserBackendType.NONE
            response = test_client.post(
                "/v1/parse",
                files={"file": ("test.txt", b"hello world", "text/plain")},
                headers=headers,
            )
        assert response.status_code == 503
        assert "not enabled" in response.json()["detail"].lower()

    def test_parse_returns_extracted_text(self, test_client: TestClient):
        """When a parser backend is configured, the endpoint returns the extracted text."""
        extracted_text = "Extracted content from document."

        mock_parser = AsyncMock()
        mock_parser.parse = AsyncMock(return_value=extracted_text)

        with (
            patch("api.routers.parsing_router.settings") as mock_settings,
            patch("api.routers.parsing_router._parser", mock_parser),
        ):
            mock_settings.PARSER_BACKEND = ParserBackendType.KREUZBERG
            response = test_client.post(
                "/v1/parse",
                files={
                    "file": ("document.pdf", b"%PDF-1.4 content", "application/pdf")
                },
                headers=headers,
            )

        assert response.status_code == 200
        assert response.json() == extracted_text
        mock_parser.parse.assert_awaited_once()

    def test_parse_passes_correct_filename(self, test_client: TestClient):
        """The parser receives an UploadFile whose filename matches the uploaded file."""
        extracted_text = "Some content."
        captured_files = []

        async def capture_parse(file):
            captured_files.append(file.filename)
            return extracted_text

        mock_parser = AsyncMock()
        mock_parser.parse = capture_parse

        with (
            patch("api.routers.parsing_router.settings") as mock_settings,
            patch("api.routers.parsing_router._parser", mock_parser),
        ):
            mock_settings.PARSER_BACKEND = ParserBackendType.KREUZBERG
            test_client.post(
                "/v1/parse",
                files={
                    "file": (
                        "my_report.docx",
                        b"docx bytes",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
                headers=headers,
            )

        assert captured_files == ["my_report.docx"]

    def test_parse_requires_authentication(self, unauthenticated_client: TestClient):
        """With an invalid token, the endpoint should reject the request with 401."""
        with patch("api.routers.parsing_router.settings") as mock_settings:
            mock_settings.PARSER_BACKEND = ParserBackendType.KREUZBERG
            response = unauthenticated_client.post(
                "/v1/parse",
                files={"file": ("test.txt", b"hello", "text/plain")},
                # Authorization header is present but contains an invalid token
                # so it passes FastAPI's parameter validation yet fails JWT parsing
                headers={"Authorization": "Bearer not.a.valid.jwt"},
            )
        assert response.status_code in (401, 403)

    def test_parse_parser_exception_propagates(self, test_client: TestClient):
        """If the parser raises an exception, the endpoint should return a 500."""
        mock_parser = AsyncMock()
        mock_parser.parse = AsyncMock(side_effect=RuntimeError("Parser crashed"))

        with (
            patch("api.routers.parsing_router.settings") as mock_settings,
            patch("api.routers.parsing_router._parser", mock_parser),
        ):
            mock_settings.PARSER_BACKEND = ParserBackendType.KREUZBERG
            # raise_server_exceptions=False makes the test client return a 500
            # response instead of re-raising the exception in the test process.
            with TestClient(api_app, raise_server_exceptions=False) as error_client:
                response = error_client.post(
                    "/v1/parse",
                    files={"file": ("broken.pdf", b"bad bytes", "application/pdf")},
                    headers=headers,
                )

        assert response.status_code == 500
