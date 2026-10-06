import asyncio
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.api_models import (
    AssistantAccessType,
    AssistantCreate,
    AssistantResponse,
    AssistantStateUpdate,
    AssistantUpdate,
    ComplianceCheckResult,
)
from api.exceptions import VersionConflictException
from api.routers.admin_assistants_router import update_assistant_state
from backend import api_app
from core.auth import require_admin
from core.auth_models import AuthenticationResult
from database.assistant_repo import AssistantRepository
from database.database_models import Base

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
@pytest.mark.asyncio
async def test_public_access_filter_uses_postgresql_json_array_length() -> None:
    session = AsyncMock()
    result = Mock()
    result.scalars.return_value.unique.return_value.all.return_value = []
    session.execute.return_value = result

    repository = AssistantRepository(session)
    await repository.get_all_assistants_for_admin(access=AssistantAccessType.PUBLIC)

    statement = session.execute.await_args.args[0]
    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "json_array_length(assistants.hierarchical_access)" in sql
    assert "assistants.hierarchical_access =" not in sql


@pytest.mark.integration
def test_high_risk_assistant_is_pending_legal_review(admin_client: TestClient) -> None:
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
    response = admin_client.post(
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

    configuration_response = admin_client.get(
        f"assistant/{assistant.id}/configuration", headers=headers
    )
    subscription_response = admin_client.post(
        f"user/subscriptions/{assistant.id}", headers=headers
    )
    assert configuration_response.status_code == 451
    assert subscription_response.status_code == 451

    inactive_response = admin_client.patch(
        f"/admin/assistant/{assistant.id}/state",
        json={
            "state": "inactive",
            "expected_state": "pending_legal_review",
            "version": assistant.latest_version.version,
        },
        headers=headers,
    )
    assert inactive_response.status_code == 200

    inactive_subscription_response = admin_client.post(
        f"user/subscriptions/{assistant.id}", headers=headers
    )
    assert inactive_subscription_response.status_code == 403
    assert inactive_subscription_response.json()["detail"] == (
        f"Assistant with ID {assistant.id} is unavailable for use"
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_admin_state_updates_return_one_conflict(tmp_path) -> None:
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'concurrent-state-update.db'}",
        connect_args={"timeout": 5},
    )
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as session:
            repository = AssistantRepository(session)
            assistant = await repository.create(owner_ids=["owner"])
            await repository.create_assistant_version(
                assistant=assistant,
                name="Concurrent review assistant",
                description="",
                system_prompt="Review this.",
                creativity="medium",
                state="pending_legal_review",
            )
            await session.commit()

        admin = AuthenticationResult(
            user_id="legal_admin_123",
            name="Legal Admin",
            department="Legal",
            is_admin=True,
        )

        async def update_state() -> int:
            async with session_factory() as session:
                try:
                    await update_assistant_state(
                        assistant_id=assistant.id,
                        state_update=AssistantStateUpdate(
                            state="active",
                            expected_state="pending_legal_review",
                            version=1,
                        ),
                        db=session,
                        admin=admin,
                    )
                except VersionConflictException as error:
                    return error.status_code
                return 200

        results = await asyncio.gather(update_state(), update_state())

        assert sorted(results) == [200, 409]
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


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
def test_non_admin_cannot_list_all_assistants(test_client: TestClient) -> None:
    response = test_client.get("admin/assistants", headers=headers)

    assert response.status_code == 403


@pytest.mark.integration
def test_admin_lists_assistants_with_latest_version_filters(
    admin_client: TestClient,
) -> None:
    public_response = admin_client.post(
        "assistant/create",
        json={
            "name": "Public assistant",
            "system_prompt": "Help with public information.",
            "compliance_check_result": {
                "overall_status": "passed",
                "results": [{"category": "education", "status": "passed"}],
            },
        },
        headers=headers,
    )
    hierarchical_response = admin_client.post(
        "assistant/create",
        json={
            "name": "Hierarchical assistant",
            "system_prompt": "Assess education eligibility.",
            "hierarchical_access": ["IT"],
            "compliance_check_result": {
                "overall_status": "high_risk_detected",
                "results": [{"category": "education", "status": "high_risk_detected"}],
            },
        },
        headers=headers,
    )
    private_response = admin_client.post(
        "assistant/create",
        json={
            "name": "Private assistant",
            "system_prompt": "Assess public service eligibility.",
            "is_visible": False,
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
    assert public_response.status_code == 200
    assert hierarchical_response.status_code == 200
    assert private_response.status_code == 200

    public = AssistantResponse.model_validate(public_response.json())
    hierarchical = AssistantResponse.model_validate(hierarchical_response.json())
    private = AssistantResponse.model_validate(private_response.json())

    inactive_response = admin_client.patch(
        f"admin/assistant/{private.id}/state",
        json={
            "state": "inactive",
            "expected_state": "pending_legal_review",
            "version": private.latest_version.version,
        },
        headers=headers,
    )
    assert inactive_response.status_code == 200

    all_assistants = admin_client.get("admin/assistants", headers=headers)
    public_list = admin_client.get(
        "admin/assistants?access=public&compliance_status=passed", headers=headers
    )
    hierarchical_list = admin_client.get(
        "admin/assistants?access=hierarchical&state=pending_legal_review&compliance_status=high_risk_detected",
        headers=headers,
    )
    department_list = admin_client.get(
        "admin/assistants?department=IT-Test-Department", headers=headers
    )
    private_list = admin_client.get(
        "admin/assistants?access=private&state=inactive", headers=headers
    )

    assert all_assistants.status_code == 200
    assert {assistant["id"] for assistant in all_assistants.json()} == {
        public.id,
        hierarchical.id,
        private.id,
    }
    assert public_list.status_code == 200
    assert [assistant["id"] for assistant in public_list.json()] == [public.id]
    assert hierarchical_list.status_code == 200
    assert [assistant["id"] for assistant in hierarchical_list.json()] == [
        hierarchical.id
    ]
    assert department_list.status_code == 200
    assert [assistant["id"] for assistant in department_list.json()] == [
        hierarchical.id
    ]
    assert private_list.status_code == 200
    assert [assistant["id"] for assistant in private_list.json()] == [private.id]


@pytest.mark.integration
def test_admin_assistant_list_paginates_after_sorting(admin_client: TestClient) -> None:
    for name in ("Charlie", "Alpha", "Bravo"):
        response = admin_client.post(
            "assistant/create",
            json={"name": name, "system_prompt": f"You are {name}."},
            headers=headers,
        )
        assert response.status_code == 200

    response = admin_client.get(
        "admin/assistants?sort_by=title&sort_order=asc&offset=1&limit=1",
        headers=headers,
    )

    assert response.status_code == 200
    assert [assistant["latest_version"]["name"] for assistant in response.json()] == [
        "Bravo"
    ]


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
