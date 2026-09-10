import pytest
from fastapi.testclient import TestClient

from api.api_models import (
    AssistantCreate,
    AssistantResponse,
    AssistantUpdate,
    ComplianceCheckResult,
)
from backend import api_app
from core.auth import require_admin
from core.auth_models import AuthenticationResult

headers = {"Authorization": "Bearer test-token"}


@pytest.fixture
def admin_client(test_client: TestClient):
    async def _get_admin():
        return AuthenticationResult(
            user_id="legal_admin_123",
            name="Legal Admin",
            department="Legal",
            is_admin=True,
        )

    api_app.dependency_overrides[require_admin] = _get_admin
    yield test_client
    api_app.dependency_overrides.pop(require_admin, None)


@pytest.mark.integration
def test_high_risk_assistant_is_pending_legal_review(test_client: TestClient) -> None:
    result = ComplianceCheckResult(
        overall_status="high_risk_detected",
        results=[
            {
                "category": "education",
                "status": "high_risk_detected",
                "reasoning": "Makes eligibility recommendations.",
            }
        ],
    )
    response = test_client.post(
        "assistant/create",
        json=AssistantCreate(
            name="High risk assistant",
            system_prompt="Assess education eligibility.",
            compliance_check_result=result,
        ).model_dump(),
        headers=headers,
    )

    assert response.status_code == 200
    assistant = AssistantResponse.model_validate(response.json())
    assert assistant.latest_version.state == "pending_legal_review"

    configuration_response = test_client.get(
        f"assistant/{assistant.id}/configuration", headers=headers
    )
    subscription_response = test_client.post(
        f"user/subscriptions/{assistant.id}", headers=headers
    )
    assert configuration_response.status_code == 451
    assert subscription_response.status_code == 451


@pytest.mark.integration
def test_owner_prompt_update_with_passing_result_reactivates_assistant(
    test_client: TestClient,
) -> None:
    create_response = test_client.post(
        "assistant/create",
        json={
            "name": "Reactivatable assistant",
            "system_prompt": "Assess education eligibility.",
            "compliance_check_result": {
                "overall_status": "high_risk_detected",
                "results": [
                    {
                        "category": "education",
                        "status": "high_risk_detected",
                    }
                ],
            },
        },
        headers=headers,
    )
    created = AssistantResponse.model_validate(create_response.json())

    update_response = test_client.post(
        f"assistant/{created.id}/update",
        json=AssistantUpdate(
            version=created.latest_version.version,
            system_prompt="Help draft a neutral education newsletter.",
            compliance_check_result=ComplianceCheckResult(
                overall_status="passed",
                results=[{"category": "education", "status": "passed"}],
            ),
        ).model_dump(),
        headers=headers,
    )

    assert update_response.status_code == 200
    updated = AssistantResponse.model_validate(update_response.json())
    assert updated.latest_version.state == "active"


@pytest.mark.integration
def test_compliance_check_error_cannot_be_saved(test_client: TestClient) -> None:
    response = test_client.post(
        "assistant/create",
        json=AssistantCreate(
            name="Unverified assistant",
            system_prompt="Do something.",
            compliance_check_result=ComplianceCheckResult(
                overall_status="error", results=[]
            ),
        ).model_dump(),
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.integration
def test_non_admin_cannot_access_review_queue(test_client: TestClient) -> None:
    response = test_client.get("admin/assistant/review", headers=headers)

    assert response.status_code == 403


@pytest.mark.integration
def test_admin_review_appends_active_version_and_preserves_tools(
    admin_client: TestClient,
) -> None:
    create_response = admin_client.post(
        "assistant/create",
        json={
            "name": "Reviewable assistant",
            "system_prompt": "Assess public service eligibility.",
            "tools": [{"id": "WEB_SEARCH", "config": {"limit": 3}}],
            "compliance_check_result": {
                "overall_status": "high_risk_detected",
                "results": [
                    {
                        "category": "public_services_access",
                        "status": "high_risk_detected",
                    }
                ],
            },
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    created = AssistantResponse.model_validate(create_response.json())

    queue_response = admin_client.get("admin/assistant/review", headers=headers)
    assert queue_response.status_code == 200
    assert [item["id"] for item in queue_response.json()] == [created.id]

    review_response = admin_client.patch(
        f"admin/assistant/{created.id}/state",
        json={
            "state": "active",
            "expected_state": "pending_legal_review",
            "version": created.latest_version.version,
            "reason": "Reviewed by legal.",
        },
        headers=headers,
    )

    assert review_response.status_code == 200
    reviewed = AssistantResponse.model_validate(review_response.json())
    assert reviewed.latest_version.version == created.latest_version.version + 1
    assert reviewed.latest_version.state == "active"
    assert reviewed.latest_version.state_changed_by == "legal_admin_123"
    assert reviewed.latest_version.state_change_reason == "Reviewed by legal."
    assert reviewed.latest_version.tools[0].id == "WEB_SEARCH"


@pytest.mark.integration
def test_admin_review_rejects_stale_version(admin_client: TestClient) -> None:
    create_response = admin_client.post(
        "assistant/create",
        json={
            "name": "Stale review assistant",
            "system_prompt": "Assess public service eligibility.",
            "compliance_check_result": {
                "overall_status": "high_risk_detected",
                "results": [
                    {
                        "category": "public_services_access",
                        "status": "high_risk_detected",
                    }
                ],
            },
        },
        headers=headers,
    )
    created = AssistantResponse.model_validate(create_response.json())

    response = admin_client.patch(
        f"admin/assistant/{created.id}/state",
        json={
            "state": "active",
            "expected_state": "pending_legal_review",
            "version": created.latest_version.version + 1,
        },
        headers=headers,
    )

    assert response.status_code == 409
