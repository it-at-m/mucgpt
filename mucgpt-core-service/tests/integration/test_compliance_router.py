import hashlib
from contextlib import nullcontext
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.api_models import ComplianceCategoryResult
from core.llm_helpers import hash_user_id


@pytest.fixture(autouse=True)
def disable_compliance_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.routers.compliance_router._cache_compliance_result", AsyncMock()
    )


@pytest.fixture
def langfuse_root(monkeypatch: pytest.MonkeyPatch):
    client = MagicMock()
    client.create_trace_id.return_value = "b" * 32
    observation = (
        client.start_as_current_observation.return_value.__enter__.return_value
    )
    propagate_attributes = MagicMock(side_effect=lambda **_kwargs: nullcontext())
    monkeypatch.setattr("api.routers.compliance_router.get_client", lambda: client)
    monkeypatch.setattr(
        "api.routers.compliance_router.propagate_attributes", propagate_attributes
    )
    return client, observation, propagate_attributes


@pytest.mark.integration
@patch("core.compliance._check_category", new_callable=AsyncMock)
def test_check_assistant_compliance_aggregates_category_results(
    mock_check_category, test_client: TestClient, langfuse_root
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
    client, observation, propagate_attributes = langfuse_root
    client.start_as_current_observation.assert_called_once_with(
        name="assistant-compliance-check",
        input=system_prompt,
        trace_context={"trace_id": "b" * 32},
    )
    propagate_attributes.assert_called_once_with(
        user_id=hash_user_id("test_user_123"),
        tags=["assistant-compliance"],
        trace_name="assistant-compliance-check",
    )
    observation.update.assert_called_once_with(output=body)


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
