import importlib
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

from api.api_models import (
    AdminOwnersUpdate,
    AdminTagsUpdate,
    AssistantCreate,
    AssistantState,
    AssistantStateUpdate,
    AssistantUpdate,
)
from api.exceptions import (
    AssistantNotFoundException,
    AssistantUnavailableForUseException,
    DeleteFailedException,
    NotAllowedToAccessException,
    NotOwnerException,
    NoVersionException,
    SubscriptionNotFoundException,
    VersionConflictException,
)
from core.auth_models import AuthenticationResult
from core.organization import LDAPPersonLookupError

admin_assistants_router = importlib.import_module("api.routers.admin_assistants_router")
assistants_router = importlib.import_module("api.routers.assistants_router")
users_router = importlib.import_module("api.routers.users_router")


USER = AuthenticationResult(
    user_id="user-1", name="Test User", department="IT", is_admin=False
)
ADMIN = AuthenticationResult(
    user_id="admin-1", name="Test Admin", department="Legal", is_admin=True
)


def _repository(monkeypatch: pytest.MonkeyPatch, module, repo: AsyncMock) -> None:
    monkeypatch.setattr(module, "AssistantRepository", lambda _db: repo)


def _assistant(*, allowed: bool = True) -> SimpleNamespace:
    assistant = SimpleNamespace(id="assistant-1")
    assistant.is_allowed_for_user = AsyncMock(return_value=allowed)
    return assistant


@pytest.mark.asyncio
async def test_create_rolls_back_when_created_assistant_cannot_be_reloaded(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    monkeypatch.setattr(assistants_router, "refresh_owner_details", AsyncMock())
    mock_assistant_repo.create.return_value = SimpleNamespace(id="assistant-1")
    mock_assistant_repo.create_assistant_version.return_value = SimpleNamespace(
        version=1
    )
    mock_assistant_repo.get_with_owners.return_value = SimpleNamespace(owners=[])
    mock_assistant_repo.get.return_value = None

    with pytest.raises(AssistantNotFoundException):
        await assistants_router.createAssistant(
            AssistantCreate(name="Assistant", system_prompt="Help."),
            mock_db_session,
            USER,
        )

    mock_db_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("source", "latest", "allowed", "owner", "exception"),
    [
        (None, None, True, False, AssistantNotFoundException),
        (_assistant(allowed=False), None, False, False, NotAllowedToAccessException),
        (_assistant(), None, True, False, NoVersionException),
        (
            _assistant(),
            SimpleNamespace(state=AssistantState.INACTIVE),
            True,
            False,
            AssistantUnavailableForUseException,
        ),
    ],
)
async def test_duplicate_rejects_missing_inaccessible_or_unavailable_source(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
    source: SimpleNamespace | None,
    latest: SimpleNamespace | None,
    allowed: bool,
    owner: bool,
    exception: type[HTTPException],
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get.return_value = source
    mock_assistant_repo.get_latest_version.return_value = latest
    mock_assistant_repo.is_owner.return_value = owner

    with pytest.raises(exception):
        await assistants_router.duplicateAssistant("assistant-1", mock_db_session, USER)

    mock_assistant_repo.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_duplicate_copies_active_source_and_commits(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    source = _assistant()
    source_version = SimpleNamespace(
        state=AssistantState.ACTIVE,
        name="Source",
        description="Description",
        system_prompt="Help.",
        creativity="medium",
        default_model=None,
        examples=[],
        quick_prompts=[],
        tags=[],
        compliance_check_result=None,
        compliance_confirmation=False,
    )
    mock_assistant_repo.get.return_value = source
    mock_assistant_repo.get_latest_version.return_value = source_version
    mock_assistant_repo.create.return_value = SimpleNamespace(id="copy-1")
    mock_assistant_repo.create_assistant_version.return_value = SimpleNamespace(
        version=1
    )
    mock_assistant_repo.get_tools_from_version = Mock(return_value=[])
    monkeypatch.setattr(assistants_router, "refresh_owner_details", AsyncMock())
    get_assistant = AsyncMock(return_value="duplicated-response")
    monkeypatch.setattr(assistants_router, "getAssistant", get_assistant)

    response = await assistants_router.duplicateAssistant(
        "assistant-1", mock_db_session, USER
    )

    assert response == "duplicated-response"
    mock_assistant_repo.record_audit_event.assert_awaited_once()
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("assistant", "owner", "deleted", "exception"),
    [
        (None, False, False, AssistantNotFoundException),
        (_assistant(), False, False, NotOwnerException),
        (_assistant(), True, False, DeleteFailedException),
    ],
)
async def test_delete_rejects_missing_non_owner_and_failed_delete(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
    assistant: SimpleNamespace | None,
    owner: bool,
    deleted: bool,
    exception: type[HTTPException],
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get_for_update.return_value = assistant
    mock_assistant_repo.is_owner.return_value = owner
    mock_assistant_repo.delete.return_value = deleted

    with pytest.raises(exception):
        await assistants_router.deleteAssistant("assistant-1", mock_db_session, USER)

    mock_db_session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_records_audit_event_and_commits(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get_for_update.return_value = _assistant()
    mock_assistant_repo.is_owner.return_value = True
    mock_assistant_repo.delete.return_value = True

    response = await assistants_router.deleteAssistant(
        "assistant-1", mock_db_session, USER
    )

    assert response == {"message": "Assistant with ID assistant-1 successfully deleted"}
    mock_assistant_repo.record_audit_event.assert_awaited_once()
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("assistant", "owner", "latest", "version", "exception"),
    [
        (None, True, None, 1, AssistantNotFoundException),
        (_assistant(), False, None, 1, NotOwnerException),
        (_assistant(), True, None, 1, NoVersionException),
        (
            _assistant(),
            True,
            SimpleNamespace(state=AssistantState.INACTIVE, version=1),
            1,
            AssistantUnavailableForUseException,
        ),
        (
            _assistant(),
            True,
            SimpleNamespace(state=AssistantState.ACTIVE, version=2),
            1,
            VersionConflictException,
        ),
    ],
)
async def test_update_rejects_missing_access_version_and_conflict(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
    assistant: SimpleNamespace | None,
    owner: bool,
    latest: SimpleNamespace | None,
    version: int,
    exception: type[HTTPException],
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get_for_update.return_value = assistant
    mock_assistant_repo.is_owner.return_value = owner
    mock_assistant_repo.get_latest_version.return_value = latest

    with pytest.raises(exception):
        await assistants_router.updateAssistant(
            "assistant-1", AssistantUpdate(version=version), mock_db_session, USER
        )

    mock_assistant_repo.create_assistant_version.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("assistant", "owner", "latest", "exception"),
    [
        (None, False, None, AssistantNotFoundException),
        (_assistant(allowed=False), False, None, NotAllowedToAccessException),
        (_assistant(), False, None, AssistantUnavailableForUseException),
        (
            _assistant(),
            False,
            SimpleNamespace(state=AssistantState.PENDING_LEGAL_REVIEW),
            AssistantUnavailableForUseException,
        ),
    ],
)
async def test_configuration_rejects_missing_inaccessible_and_inactive_assistants(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
    assistant: SimpleNamespace | None,
    owner: bool,
    latest: SimpleNamespace | None,
    exception: type[HTTPException],
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get.return_value = assistant
    mock_assistant_repo.is_owner.return_value = owner
    mock_assistant_repo.get_latest_version.return_value = latest

    with pytest.raises(exception):
        await assistants_router.get_assistant_configuration_for_use(
            "assistant-1", mock_db_session, USER
        )


@pytest.mark.asyncio
async def test_get_all_assistants_builds_response_for_accessible_assistant(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    version = SimpleNamespace(
        version=1,
        created_at=datetime.now(UTC),
        name="Available assistant",
        description="Useful work.",
        system_prompt="Help.",
        creativity="medium",
        default_model=None,
        examples=[],
        quick_prompts=[],
        tags=["work"],
        compliance_check_result=None,
        compliance_confirmation=False,
        state=AssistantState.ACTIVE,
        state_changed_by=None,
        state_change_reason=None,
    )
    assistant = SimpleNamespace(
        id="assistant-1",
        versions=[version],
        owners=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        hierarchical_access=["IT"],
        is_visible=True,
        admin_tags=["featured"],
        subscriptions_count=2,
    )
    mock_assistant_repo.get_all_possible_assistants_for_user_with_department.return_value = [
        assistant
    ]
    mock_assistant_repo.get_tools_from_version = Mock(return_value=[])
    monkeypatch.setattr(
        assistants_router, "build_owner_details", AsyncMock(return_value=[])
    )

    assistants = await assistants_router.getAllAssistants(
        db=mock_db_session, user_info=USER
    )

    assert assistants[0].id == "assistant-1"
    assert assistants[0].latest_version.name == "Available assistant"
    assert assistants[0].subscriptions_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("assistant", "owner", "exception"),
    [
        (None, False, AssistantNotFoundException),
        (_assistant(allowed=False), False, NotAllowedToAccessException),
    ],
)
async def test_get_assistant_rejects_missing_or_inaccessible_assistant(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
    assistant: SimpleNamespace | None,
    owner: bool,
    exception: type[HTTPException],
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get.return_value = assistant
    mock_assistant_repo.is_owner.return_value = owner

    with pytest.raises(exception):
        await assistants_router.getAssistant("assistant-1", mock_db_session, USER)


@pytest.mark.asyncio
async def test_get_assistant_requires_owner_record_after_access_check(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, assistants_router, mock_assistant_repo)
    mock_assistant_repo.get.return_value = _assistant()
    mock_assistant_repo.get_with_owners.return_value = None

    with pytest.raises(AssistantNotFoundException):
        await assistants_router.getAssistant("assistant-1", mock_db_session, USER)


@pytest.mark.asyncio
async def test_admin_tags_reject_missing_assistant_and_missing_refresh(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, admin_assistants_router, mock_assistant_repo)
    mock_assistant_repo.get_for_update.return_value = None

    with pytest.raises(AssistantNotFoundException):
        await admin_assistants_router.update_admin_tags(
            "assistant-1",
            AdminTagsUpdate(admin_tags=["featured"]),
            mock_db_session,
            ADMIN,
        )

    assistant = SimpleNamespace(admin_tags=[])
    mock_assistant_repo.get_for_update.return_value = assistant
    mock_assistant_repo.get_with_owners.return_value = None
    with pytest.raises(AssistantNotFoundException):
        await admin_assistants_router.update_admin_tags(
            "assistant-1",
            AdminTagsUpdate(admin_tags=["featured"]),
            mock_db_session,
            ADMIN,
        )

    mock_assistant_repo.update_admin_tags.assert_awaited_once_with(
        assistant, ["featured"]
    )
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_list_and_review_queue_delegate_to_response_builder(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, admin_assistants_router, mock_assistant_repo)
    assistants = [SimpleNamespace()]
    mock_assistant_repo.get_all_assistants_for_admin.return_value = assistants
    mock_assistant_repo.get_assistants_by_latest_state.return_value = assistants
    build_response = AsyncMock(return_value=["assistant-response"])
    monkeypatch.setattr(
        admin_assistants_router, "_build_assistant_response_list", build_response
    )

    listed = await admin_assistants_router.get_all_assistants(
        db=mock_db_session, _admin=ADMIN
    )
    reviewed = await admin_assistants_router.get_review_queue(
        db=mock_db_session, _admin=ADMIN
    )

    assert listed == ["assistant-response"]
    assert reviewed == ["assistant-response"]
    assert build_response.await_count == 2


@pytest.mark.asyncio
async def test_admin_owner_update_refreshes_details_and_returns_response(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, admin_assistants_router, mock_assistant_repo)
    assistant = SimpleNamespace()
    mock_assistant_repo.get_for_update.return_value = assistant
    mock_assistant_repo.get_owner_ids.return_value = ["owner-1"]
    mock_assistant_repo.get_with_owners.return_value = SimpleNamespace()
    monkeypatch.setattr(admin_assistants_router, "refresh_owner_details", AsyncMock())
    monkeypatch.setattr(
        admin_assistants_router,
        "_build_assistant_response_list",
        AsyncMock(return_value=["owner-response"]),
    )

    response = await admin_assistants_router.update_admin_owners(
        "assistant-1",
        AdminOwnersUpdate(owner_ids=["owner-2", "owner-2"]),
        mock_db_session,
        ADMIN,
    )

    assert response == "owner-response"
    mock_assistant_repo.update.assert_awaited_once_with(
        assistant_id="assistant-1", owner_ids=["owner-2"], assistant=assistant
    )
    mock_assistant_repo.record_audit_event.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_state_update_rejects_missing_and_claim_conflict(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, admin_assistants_router, mock_assistant_repo)
    update = AssistantStateUpdate(
        state=AssistantState.ACTIVE,
        expected_state=AssistantState.PENDING_LEGAL_REVIEW,
        version=1,
    )
    mock_assistant_repo.get_for_update.return_value = None
    with pytest.raises(AssistantNotFoundException):
        await admin_assistants_router.update_assistant_state(
            "assistant-1", update, mock_db_session, ADMIN
        )

    mock_assistant_repo.get_for_update.return_value = _assistant()
    mock_assistant_repo.claim_version_update.return_value = False
    mock_assistant_repo.get_latest_version.return_value = SimpleNamespace(version=2)
    with pytest.raises(VersionConflictException):
        await admin_assistants_router.update_assistant_state(
            "assistant-1", update, mock_db_session, ADMIN
        )

    mock_db_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_state_update_appends_review_version_and_audit_event(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, admin_assistants_router, mock_assistant_repo)
    latest = SimpleNamespace(
        version=1,
        state=AssistantState.PENDING_LEGAL_REVIEW,
        name="Reviewable",
        description="Description",
        system_prompt="Help.",
        creativity="medium",
        default_model=None,
        examples=[],
        quick_prompts=[],
        tags=[],
        compliance_check_result=None,
        compliance_confirmation=False,
        tool_associations=[],
    )
    mock_assistant_repo.get_for_update.return_value = _assistant()
    mock_assistant_repo.claim_version_update.return_value = True
    mock_assistant_repo.get_latest_version.return_value = latest
    mock_assistant_repo.create_assistant_version.return_value = SimpleNamespace(
        version=2
    )
    mock_assistant_repo.get_with_owners.return_value = SimpleNamespace()
    monkeypatch.setattr(
        admin_assistants_router,
        "_build_assistant_response_list",
        AsyncMock(return_value=["reviewed-response"]),
    )

    response = await admin_assistants_router.update_assistant_state(
        "assistant-1",
        AssistantStateUpdate(
            state=AssistantState.ACTIVE,
            expected_state=AssistantState.PENDING_LEGAL_REVIEW,
            version=1,
            reason="Reviewed.",
        ),
        mock_db_session,
        ADMIN,
    )

    assert response == "reviewed-response"
    mock_assistant_repo.record_audit_event.assert_awaited_once()
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_audit_events_distinguishes_empty_history_from_missing_assistant(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, admin_assistants_router, mock_assistant_repo)
    mock_assistant_repo.get_audit_events.return_value = []
    mock_assistant_repo.get.return_value = None

    with pytest.raises(AssistantNotFoundException):
        await admin_assistants_router.get_assistant_audit_events(
            "assistant-1", db=mock_db_session, _admin=ADMIN
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("assistant", "latest", "subscribed", "exception"),
    [
        (None, None, False, AssistantNotFoundException),
        (_assistant(allowed=False), None, False, NotAllowedToAccessException),
        (_assistant(), None, False, AssistantUnavailableForUseException),
        (
            _assistant(),
            SimpleNamespace(state=AssistantState.INACTIVE),
            False,
            AssistantUnavailableForUseException,
        ),
        (
            _assistant(),
            SimpleNamespace(state=AssistantState.ACTIVE),
            True,
            HTTPException,
        ),
    ],
)
async def test_subscribe_rejects_invalid_subscription_states(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
    assistant: SimpleNamespace | None,
    latest: SimpleNamespace | None,
    subscribed: bool,
    exception: type[HTTPException],
) -> None:
    _repository(monkeypatch, users_router, mock_assistant_repo)
    mock_assistant_repo.get_for_update.return_value = assistant
    mock_assistant_repo.get_latest_version.return_value = latest
    mock_assistant_repo.is_user_subscribed.return_value = subscribed

    with pytest.raises(exception):
        await users_router.subscribe_to_assistant("assistant-1", mock_db_session, USER)

    mock_assistant_repo.create_subscription.assert_not_awaited()


@pytest.mark.asyncio
async def test_unsubscribe_rejects_missing_subscription(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, users_router, mock_assistant_repo)
    mock_assistant_repo.is_user_subscribed.return_value = False

    with pytest.raises(SubscriptionNotFoundException):
        await users_router.unsubscribe_from_assistant(
            "assistant-1", mock_db_session, USER
        )

    mock_assistant_repo.remove_subscription.assert_not_awaited()


@pytest.mark.asyncio
async def test_subscription_changes_commit_after_repository_mutation(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, users_router, mock_assistant_repo)
    mock_assistant_repo.get_for_update.return_value = _assistant()
    mock_assistant_repo.get_latest_version.return_value = SimpleNamespace(
        state=AssistantState.ACTIVE
    )
    mock_assistant_repo.is_user_subscribed.side_effect = [False, True]

    subscribed = await users_router.subscribe_to_assistant(
        "assistant-1", mock_db_session, USER
    )
    unsubscribed = await users_router.unsubscribe_from_assistant(
        "assistant-1", mock_db_session, USER
    )

    assert subscribed.message == "Successfully subscribed to assistant"
    assert unsubscribed.message == "Successfully unsubscribed from assistant"
    mock_assistant_repo.create_subscription.assert_awaited_once_with(
        "assistant-1", "user-1"
    )
    mock_assistant_repo.remove_subscription.assert_awaited_once_with(
        "assistant-1", "user-1"
    )
    assert mock_db_session.commit.await_count == 2


@pytest.mark.asyncio
async def test_get_user_subscriptions_builds_response_for_latest_version(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, users_router, mock_assistant_repo)
    version = SimpleNamespace(
        name="Subscribed assistant",
        description="Useful work.",
        tags=["work"],
        state=AssistantState.ACTIVE,
    )
    assistant = SimpleNamespace(
        id="assistant-1",
        versions=[version],
        owners=[],
        updated_at=datetime.now(UTC),
        subscriptions_count=3,
        admin_tags=["featured"],
        is_visible=True,
    )
    mock_assistant_repo.get_user_subscriptions.return_value = [assistant]
    monkeypatch.setattr(users_router, "build_owner_details", AsyncMock(return_value=[]))

    subscriptions = await users_router.get_user_subscriptions(
        db=mock_db_session, user_info=USER
    )

    assert subscriptions[0].id == "assistant-1"
    assert subscriptions[0].title == "Subscribed assistant"
    assert subscriptions[0].subscriptions_count == 3


@pytest.mark.asyncio
async def test_get_user_assistants_delegates_to_shared_response_builder(
    monkeypatch: pytest.MonkeyPatch,
    mock_db_session: AsyncMock,
    mock_assistant_repo: AsyncMock,
) -> None:
    _repository(monkeypatch, users_router, mock_assistant_repo)
    assistants = [SimpleNamespace()]
    mock_assistant_repo.get_assistants_by_owner.return_value = assistants
    build_response = AsyncMock(return_value=["assistant-response"])
    monkeypatch.setattr(users_router, "_build_assistant_response_list", build_response)

    response = await users_router.getUserAssistants(db=mock_db_session, user_info=USER)

    assert response == ["assistant-response"]
    mock_assistant_repo.get_assistants_by_owner.assert_awaited_once()
    build_response.assert_awaited_once_with(assistants, mock_assistant_repo)


@pytest.mark.asyncio
async def test_lookup_user_translates_ldap_error_to_service_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise_lookup_error(*_args: object) -> None:
        raise LDAPPersonLookupError("directory unavailable")

    monkeypatch.setattr(users_router.asyncio, "to_thread", _raise_lookup_error)

    with pytest.raises(HTTPException, match="directory unavailable") as error:
        await users_router.lookup_user_by_user_id("user-2", USER)

    assert error.value.status_code == 503
