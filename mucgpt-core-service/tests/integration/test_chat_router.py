import json
from unittest.mock import AsyncMock, Mock, patch

import pytest
from ag_ui.core.events import (
    EventType,
    RunErrorEvent,
)
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from agent.agent_executor import MUCGPTAgentExecutor
from agent.deep_agent import PendingToolApproval
from api.api_models import ChatCompletionMessage, ChatCompletionRequest
from api.exception import RATE_LIMITED
from api.routers.chat_router import CONVERSATION_RUN_LOCK_PREFIX
from config.model_provider import ModelRegistry, ModelsConfigurationException

DUMMY_CONVERSATION_ID = "conv-test-1"


def native_run_body(**overrides) -> dict:
    """A minimal valid native AG-UI run input for the v2 endpoint."""
    body = {
        "threadId": DUMMY_CONVERSATION_ID,
        "runId": "run-42",
        "protocolVersion": "1.0",
        "messages": [{"id": "m1", "role": "user", "content": "Hello"}],
        "forwardedProps": {"mucgpt": {"model": "gpt-4o-mini", "persist": False}},
        "state": {},
        "tools": [],
        "context": [],
        "resume": [],
    }
    body.update(overrides)
    return body


@pytest.fixture(autouse=True)
def stub_persistence(monkeypatch: pytest.MonkeyPatch) -> None:
    from core.persistance_helpers import PersistanceHelpers

    monkeypatch.setattr("api.routers.chat_router._save_document_selection", AsyncMock())

    monkeypatch.setattr(
        PersistanceHelpers, "verify_user_in_conversation", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        PersistanceHelpers, "is_user_in_conversation", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        PersistanceHelpers, "has_checkpoint", AsyncMock(return_value=False)
    )


@pytest.fixture(autouse=True)
def initialized_model_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    model = FakeListChatModel(responses=["test"])

    def get_model(model_name: str | None = None, **_: object) -> BaseChatModel:
        if model_name in {None, "gpt-4o-mini"}:
            return model
        raise ModelsConfigurationException(
            f"Model {model_name!r} not found in the registry"
        )

    monkeypatch.setattr(ModelRegistry, "get_model", get_model)


class TestChatRouter:
    def test_legacy_chat_endpoint_is_not_available(
        self, test_client: TestClient
    ) -> None:
        response = test_client.post(
            "/v1/chat/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [],
                "conversation_id": DUMMY_CONVERSATION_ID,
            },
        )
        assert response.status_code == 404

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_stream_run_error_carries_code_and_detail(
        self, mock_init_agent: AsyncMock, test_client: TestClient
    ) -> None:
        async def executor_run_error_stream():
            yield RunErrorEvent(
                type=EventType.RUN_ERROR,
                message="exception: openai.RateLimitError\nmessage: Too many",
                code=RATE_LIMITED,
                metadata={
                    "detail": "exception: openai.RateLimitError\nmessage: Too many"
                },
            )

        mock_agent = Mock()
        mock_agent.run_agui_with_streaming.return_value = executor_run_error_stream()
        mock_init_agent.return_value = mock_agent
        payload = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[ChatCompletionMessage(role="user", content="hi")],
            conversation_id=DUMMY_CONVERSATION_ID,
            persist=False,
        ).model_dump()

        response = test_client.post("/v1/chat/v2/completions", json=payload)

        assert response.status_code == 200
        events = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        error = next(event for event in events if event.get("type") == "RUN_ERROR")
        assert error["code"] == RATE_LIMITED
        assert error["metadata"]["detail"] == error["message"]

    @pytest.mark.parametrize("stream", [False, True])
    def test_ag_ui_rejects_unknown_model(
        self, test_client: TestClient, stream: bool
    ) -> None:
        payload = ChatCompletionRequest(
            model="invalid-model",
            messages=[ChatCompletionMessage(role="user", content="Hello")],
            stream=stream,
            conversation_id=DUMMY_CONVERSATION_ID,
        ).model_dump()

        response = test_client.post("/v1/chat/v2/completions", json=payload)

        assert response.status_code == 400
        assert response.json() == {
            "detail": "Model 'invalid-model' not found in the registry"
        }

    def _paused_executor(self, mock_init_agent: AsyncMock) -> Mock:
        async def no_events():
            return
            yield

        mock_agent_executor = Mock(MUCGPTAgentExecutor)
        mock_agent_executor.run_agui_with_streaming.return_value = no_events()
        mock_agent_executor.get_pending_approvals = AsyncMock(
            return_value=[
                PendingToolApproval(
                    tool_call_id="call_web",
                    tool_name="web_search",
                    args={"query": "Kita"},
                    data_classification="public",
                )
            ]
        )
        mock_init_agent.return_value = mock_agent_executor
        return mock_agent_executor

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_resume_continues_the_paused_run(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from core.persistance_helpers import PersistanceHelpers

        monkeypatch.setattr(
            PersistanceHelpers,
            "is_user_in_conversation",
            AsyncMock(return_value=True),
        )
        get_messages = AsyncMock()
        monkeypatch.setattr(
            "api.routers.chat_router.get_messages_for_agent", get_messages
        )
        mock_agent_executor = self._paused_executor(mock_init_agent)

        response = test_client.post(
            "/v1/chat/v2/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "Wie teuer ist die Kita?"}],
                "conversation_id": DUMMY_CONVERSATION_ID,
                "resume": [
                    {
                        "interruptId": "call_web",
                        "status": "resolved",
                        "payload": {"decision": "approve"},
                    }
                ],
            },
        )

        assert response.status_code == 200, response.text
        get_messages.assert_not_awaited()
        call_kwargs = mock_agent_executor.run_agui_with_streaming.call_args.kwargs
        assert call_kwargs["resume_decisions"] == [{"type": "approve"}]
        assert call_kwargs["messages"] == []

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_native_resume_forwards_generic_interrupt_payloads(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
    ) -> None:
        mock_agent_executor = self._paused_executor(mock_init_agent)
        mock_agent_executor.get_pending_approvals.return_value = []

        response = test_client.post(
            "/v1/chat/v2/completions",
            json=native_run_body(
                messages=[],
                forwardedProps={"mucgpt": {"model": "gpt-4o-mini", "persist": True}},
                resume=[
                    {
                        "interruptId": "question-1",
                        "status": "resolved",
                        "payload": "yes",
                    }
                ],
            ),
        )

        assert response.status_code == 200, response.text
        call_kwargs = mock_agent_executor.run_agui_with_streaming.call_args.kwargs
        assert call_kwargs["resume"] == {"question-1": "yes"}
        assert call_kwargs["resume_decisions"] is None

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_native_resume_cannot_bypass_tool_approval_validation(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
    ) -> None:
        mock_agent_executor = self._paused_executor(mock_init_agent)

        response = test_client.post(
            "/v1/chat/v2/completions",
            json=native_run_body(
                messages=[],
                forwardedProps={"mucgpt": {"model": "gpt-4o-mini", "persist": True}},
                resume=[
                    {
                        "interruptId": "call_web",
                        "status": "resolved",
                        "payload": {"decision": "approve"},
                    }
                ],
            ),
        )

        assert response.status_code == 200, response.text
        call_kwargs = mock_agent_executor.run_agui_with_streaming.call_args.kwargs
        assert call_kwargs["resume"] is None
        assert call_kwargs["resume_decisions"] == [{"type": "approve"}]

    @pytest.mark.parametrize(
        ("resume", "persist", "is_owner", "status_code"),
        [
            ([{"interruptId": "call_other", "status": "cancelled"}], True, True, 400),
            ([{"interruptId": "call_web", "status": "cancelled"}], False, True, 400),
            ([{"interruptId": "call_web", "status": "cancelled"}], True, False, 403),
        ],
    )
    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_refuses_invalid_resumes(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
        resume: list[dict],
        persist: bool,
        is_owner: bool,
        status_code: int,
    ) -> None:
        from core.persistance_helpers import PersistanceHelpers

        monkeypatch.setattr(
            PersistanceHelpers,
            "is_user_in_conversation",
            AsyncMock(return_value=is_owner),
        )
        mock_agent_executor = self._paused_executor(mock_init_agent)

        response = test_client.post(
            "/v1/chat/v2/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [],
                "conversation_id": DUMMY_CONVERSATION_ID,
                "persist": persist,
                "resume": resume,
            },
        )

        assert response.status_code == status_code, response.text
        mock_agent_executor.run_agui_with_streaming.assert_not_called()

    @staticmethod
    def _streaming_executor(mock_init_agent: AsyncMock) -> Mock:
        async def no_events():
            return
            yield

        mock_agent_executor = Mock(MUCGPTAgentExecutor)
        mock_agent_executor.run_agui_with_streaming.side_effect = lambda **_kwargs: (
            no_events()
        )
        mock_init_agent.return_value = mock_agent_executor
        return mock_agent_executor

    @staticmethod
    def _post_message(test_client: TestClient, persist: bool = True):
        return test_client.post(
            "/v1/chat/v2/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "Hallo"}],
                "conversation_id": DUMMY_CONVERSATION_ID,
                "persist": persist,
            },
        )

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_refuses_a_second_run_of_the_same_conversation(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
        held_run_locks: set[str],
    ) -> None:
        mock_agent_executor = self._streaming_executor(mock_init_agent)
        held_run_locks.add(f"{CONVERSATION_RUN_LOCK_PREFIX}:{DUMMY_CONVERSATION_ID}")

        response = self._post_message(test_client)

        assert response.status_code == 409, response.text
        mock_agent_executor.run_agui_with_streaming.assert_not_called()

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_frees_the_conversation_when_a_run_ends(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
        held_run_locks: set[str],
    ) -> None:
        self._streaming_executor(mock_init_agent)

        assert self._post_message(test_client).status_code == 200
        assert self._post_message(test_client).status_code == 200
        assert held_run_locks == set()

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_frees_the_conversation_when_a_run_cannot_start(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
        held_run_locks: set[str],
    ) -> None:
        self._paused_executor(mock_init_agent)

        response = test_client.post(
            "/v1/chat/v2/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [],
                "conversation_id": DUMMY_CONVERSATION_ID,
                "resume": [{"interruptId": "call_other", "status": "cancelled"}],
            },
        )

        assert response.status_code == 400, response.text
        assert held_run_locks == set()

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_stateless_runs_are_not_locked(
        self,
        mock_init_agent: AsyncMock,
        test_client: TestClient,
        held_run_locks: set[str],
    ) -> None:
        self._streaming_executor(mock_init_agent)
        held_run_locks.add(f"{CONVERSATION_RUN_LOCK_PREFIX}:{DUMMY_CONVERSATION_ID}")

        assert self._post_message(test_client, persist=False).status_code == 200
