"""Integration tests for the POST /v1/export endpoint."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from export.converter import ExportRequest


def _client() -> TestClient:
    api_app.dependency_overrides[authenticate_user] = lambda: AuthenticationResult(
        user_id="u", token="t", department="d"
    )
    return TestClient(api_app)


def teardown_function():
    api_app.dependency_overrides.clear()


def _payload() -> dict:
    return {"markdown": "# hi", "html": "<h1>hi</h1>", "target": "pdf"}


def test_export_streams_converted_file_with_download_headers():
    with patch(
        "api.routers.export_router.convert_export",
        return_value=(b"PDFBYTES", "application/pdf", "canvas.pdf"),
    ) as convert:
        response = _client().post("/v1/export", json=_payload())

    assert response.status_code == 200
    assert response.content == b"PDFBYTES"
    assert response.headers["content-type"].startswith("application/pdf")
    assert (
        response.headers["content-disposition"]
        == 'attachment; filename="canvas.pdf"'
    )
    request = convert.call_args.args[0]
    assert isinstance(request, ExportRequest)
    assert request.target == "pdf"


def test_export_failure_returns_502():
    with patch(
        "api.routers.export_router.convert_export",
        MagicMock(side_effect=RuntimeError("weasyprint exploded")),
    ):
        response = _client().post("/v1/export", json=_payload())

    assert response.status_code == 502
    assert response.json()["detail"] == "Conversion failed."


def test_export_rejects_unknown_target():
    response = _client().post(
        "/v1/export",
        json={"markdown": "# hi", "html": "<h1>hi</h1>", "target": "pptx"},
    )

    assert response.status_code == 422
