import hashlib
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from api.api_models import ComplianceCategoryResult


@pytest.fixture(autouse=True)
def disable_compliance_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.routers.compliance_router._cache_compliance_result", AsyncMock()
    )


@pytest.mark.integration
@patch("core.compliance._check_category", new_callable=AsyncMock)
def test_check_assistant_compliance_aggregates_category_results(
    mock_check_category, test_client: TestClient
) -> None:
    system_prompt = "Bewerte Bewerbungen und erstelle eine Rangliste."
    results = {
        "migration_asylum_border": ComplianceCategoryResult(
            category="migration_asylum_border", status="passed"
        ),
        "public_services_access": ComplianceCategoryResult(
            category="public_services_access", status="passed"
        ),
        "hr_employment": ComplianceCategoryResult(
            category="hr_employment",
            status="high_risk_detected",
            reasoning="Der Prompt erstellt eine Rangliste von Bewerbenden.",
        ),
        "education": ComplianceCategoryResult(category="education", status="passed"),
    }

    async def check_category(*, category, **_kwargs):
        return results[category]

    mock_check_category.side_effect = check_category

    response = test_client.post(
        "/v1/compliance/check", json={"system_prompt": system_prompt}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overall_status"] == "high_risk_detected"
    assert [result["category"] for result in body["results"]] == [
        "migration_asylum_border",
        "public_services_access",
        "hr_employment",
        "education",
    ]
    assert body["results"][2] == {
        "category": "hr_employment",
        "status": "high_risk_detected",
        "reasoning": "Der Prompt erstellt eine Rangliste von Bewerbenden.",
    }
    assert (
        body["prompt_hash"] == hashlib.sha256(system_prompt.encode("utf-8")).hexdigest()
    )
    assert {
        call.kwargs["category"] for call in mock_check_category.await_args_list
    } == {
        "migration_asylum_border",
        "public_services_access",
        "hr_employment",
        "education",
    }


@pytest.mark.integration
@patch("core.compliance._check_category", new_callable=AsyncMock)
def test_check_assistant_compliance_returns_error_for_category_failure(
    mock_check_category, test_client: TestClient
) -> None:
    system_prompt = "Hilf beim Formulieren einer Stellenanzeige."
    mock_check_category.side_effect = RuntimeError("malformed verdict")

    response = test_client.post(
        "/v1/compliance/check", json={"system_prompt": system_prompt}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "overall_status": "error",
        "results": [],
        "prompt_hash": hashlib.sha256(system_prompt.encode("utf-8")).hexdigest(),
    }
