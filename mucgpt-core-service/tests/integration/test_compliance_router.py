import hashlib
from collections.abc import Sequence
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage


class _FakeConfiguredModel:
    def __init__(self, response_by_run_name: dict[str, str]) -> None:
        self._response_by_run_name = response_by_run_name
        self._run_name = ""
        self.run_names: list[str] = []
        self._capture_owner: _FakeConfiguredModel = self

    def bind(self, **_kwargs: Any) -> "_FakeConfiguredModel":
        return self

    def with_structured_output(self, schema: type[Any]) -> "_FakeConfiguredModel":
        structured = _FakeConfiguredModel(self._response_by_run_name)
        structured._run_name = self._run_name
        structured._structured_output_schema = schema
        structured._capture_owner = self._capture_owner
        return structured

    async def ainvoke(self, messages: Sequence[Any], config: Any = None) -> AIMessage:
        run_name = (config or {}).get("run_name") or ""
        self._capture_owner.run_names.append(run_name)
        return self._structured_output_schema.model_validate_json(
            self._response_by_run_name[run_name]
        )


@pytest.mark.integration
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_check_assistant_compliance_aggregates_category_results(
    mock_get_model, test_client: TestClient
) -> None:
    system_prompt = "Bewerte Bewerbungen und erstelle eine Rangliste."
    mock_get_model.return_value = _FakeConfiguredModel(
        {
            "assistant-compliance-migration_asylum_border": '{"verdict":"passed","reasoning":null}',
            "assistant-compliance-public_services_access": '{"verdict":"passed","reasoning":null}',
            "assistant-compliance-hr_employment": '{"verdict":"high_risk_detected","reasoning":"Der Prompt erstellt eine Rangliste von Bewerbenden."}',
            "assistant-compliance-education": '{"verdict":"passed","reasoning":null}',
        }
    )

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
    assert set(mock_get_model.return_value.run_names) == {
        "assistant-compliance-migration_asylum_border",
        "assistant-compliance-public_services_access",
        "assistant-compliance-hr_employment",
        "assistant-compliance-education",
    }


@pytest.mark.integration
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_check_assistant_compliance_returns_error_for_malformed_verdict(
    mock_get_model, test_client: TestClient
) -> None:
    system_prompt = "Hilf beim Formulieren einer Stellenanzeige."
    mock_get_model.return_value = _FakeConfiguredModel(
        {
            "assistant-compliance-migration_asylum_border": '{"verdict":"passed","reasoning":null}',
            "assistant-compliance-public_services_access": "not json",
            "assistant-compliance-hr_employment": '{"verdict":"passed","reasoning":null}',
            "assistant-compliance-education": '{"verdict":"passed","reasoning":null}',
        }
    )

    response = test_client.post(
        "/v1/compliance/check", json={"system_prompt": system_prompt}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "overall_status": "error",
        "results": [],
        "prompt_hash": hashlib.sha256(system_prompt.encode("utf-8")).hexdigest(),
    }
