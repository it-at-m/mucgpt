from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from deepagents.backends.utils import create_file_data
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore

import init_app
from agent import deep_agent
from agent.agent_executor import MUCGPTAgentExecutor
from agent.deep_agent import MUCGPTAgent
from agent.tools.tools import ToolCollection
from core.auth_models import AuthenticationResult
from core.document_service import SelectedDocument
from core.lf_prompts import ResolvedPrompt
from core.persistance_helpers import PersistanceHelpers
from core.virtual_file_system_helper import create_permissions
from init_app import ModelOptions, init_agent


class TestInitApp:
    """Tests for the init_app module functions."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # mock model
        self.mock_model = FakeListChatModel(responses=["response"])
        self.mock_agent = MagicMock(spec=MUCGPTAgent)

        # mock user
        self.mock_user = AuthenticationResult(
            token="token", user_id="demo-user-5", department="department"
        )

        # mock tool_collection
        self.tool_collection = MagicMock(spec=ToolCollection)

    @pytest.fixture(autouse=True)
    def document_store(self, monkeypatch):
        store = InMemoryStore()
        monkeypatch.setattr(init_app.FileStoreManager, "get_store", lambda: store)
        return store

    @pytest.mark.asyncio
    @pytest.mark.parametrize("selection_kind", ["omitted", "empty", "selected"])
    @patch("config.model_provider.ModelRegistry.get_model")
    @patch("agent.tools.tools.ToolCollection.get_tools", new_callable=AsyncMock)
    async def test_init_agent_calls_correct_components(
        self,
        mock_get_tools,
        mock_get_model,
        monkeypatch: pytest.MonkeyPatch,
        document_store,
        selection_kind,
    ):
        # Arrange
        mock_get_model.return_value = self.mock_model
        mock_get_tools.return_value = []
        monkeypatch.setattr(
            "agent.deep_agent.PromptPool.get_resolved_prompt",
            lambda _name, _folder=None: ResolvedPrompt(content="default instruction"),
        )
        checkpointer = InMemorySaver()
        get_checkpointer = MagicMock(return_value=checkpointer)
        monkeypatch.setattr(
            PersistanceHelpers,
            "get_checkpointer_if_ready",
            get_checkpointer,
        )
        create_agent = MagicMock(wraps=deep_agent.create_deep_agent)
        monkeypatch.setattr(deep_agent, "create_deep_agent", create_agent)
        document = MagicMock(spec=SelectedDocument)
        document.id = "b7d5c05a-f72b-4cbb-9a99-c1d8592e7dd5"
        document.filename = "Policy.pdf"
        document.path = f"/documents/{document.id}.txt"
        document.text_length = 10000
        document.preview = "Server-resolved initial excerpt"
        selection_kwargs = {
            "omitted": {},
            "empty": {"document_selection": []},
            "selected": {"document_selection": [document]},
        }[selection_kind]

        # Act
        result = await init_agent(self.mock_user, **cast("dict[str, Any]", selection_kwargs))

        # Assert
        mock_get_model.assert_called_once()
        mock_get_tools.assert_called_once()

        assert result.agent.model == self.mock_model
        assert isinstance(result, MUCGPTAgentExecutor)
        get_checkpointer.assert_called_once()
        create_agent.assert_called_once()
        kwargs = create_agent.call_args.kwargs
        document_context = kwargs["middleware"][0].document_context
        if selection_kind == "selected":
            assert document.path in document_context
            assert document.preview in document_context
        else:
            assert document_context == ""
        assert kwargs["checkpointer"] is checkpointer
        assert kwargs["permissions"] == create_permissions(
            [document.id] if selection_kind == "selected" else []
        )
        await document_store.aput(
            ("user_documents", "demo-user-5"),
            f"/{document.id}.txt",
            create_file_data("owner document"),
        )
        read_result = await kwargs["backend"].aread(f"/documents/{document.id}.txt")
        if selection_kind == "selected":
            assert read_result.file_data["content"] == "owner document"
        else:
            assert read_result.error == "permission denied: document is not attached"

    @pytest.mark.asyncio
    @patch("config.model_provider.ModelRegistry.get_model")
    @patch("agent.tools.tools.ToolCollection.get_tools", new_callable=AsyncMock)
    async def test_init_agent_without_persistence_skips_checkpointer(
        self,
        mock_get_tools,
        mock_get_model,
        monkeypatch: pytest.MonkeyPatch,
    ):
        mock_get_model.return_value = self.mock_model
        mock_get_tools.return_value = []
        monkeypatch.setattr(
            "agent.deep_agent.PromptPool.get_resolved_prompt",
            lambda _name, _folder=None: ResolvedPrompt(content="default instruction"),
        )
        get_checkpointer = MagicMock(return_value=InMemorySaver())
        monkeypatch.setattr(
            PersistanceHelpers, "get_checkpointer_if_ready", get_checkpointer
        )

        result = await init_agent(self.mock_user, persist=False)

        assert isinstance(result, MUCGPTAgentExecutor)
        get_checkpointer.assert_not_called()

    def test_model_options_validates_temperature_too_high(self):
        """Test that ModelOptions validates temperature is not too high."""
        # Act & Assert
        with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
            ModelOptions(temperature=1.5)

    def test_model_options_validates_temperature_too_low(self):
        """Test that ModelOptions validates temperature is not too low."""
        # Act & Assert
        with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
            ModelOptions(temperature=-0.1)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failing_component", ["redis", "files", "catalog", "persistence"]
)
async def test_shutdown_attempts_all_resource_cleanup(monkeypatch, failing_component):
    redis_close = AsyncMock()
    files_close = AsyncMock()
    persistence_close = AsyncMock()
    catalog_close = AsyncMock()
    cleanup = {
        "redis": redis_close,
        "files": files_close,
        "persistence": persistence_close,
        "catalog": catalog_close,
    }
    cleanup[failing_component].side_effect = RuntimeError("close failed")
    monkeypatch.setattr(
        init_app.RedisCache,
        "get_redis",
        AsyncMock(return_value=MagicMock(aclose=redis_close)),
    )
    monkeypatch.setattr(init_app.FileStoreManager, "close", files_close)
    monkeypatch.setattr(init_app.DocumentCatalogManager, "close", catalog_close)
    monkeypatch.setattr(init_app.PersistanceHelpers, "close", persistence_close)

    await init_app.destroy_app()

    for close in cleanup.values():
        close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("failing_component", ["files", "catalog"])
async def test_document_startup_failure_cleans_up_app(monkeypatch, failing_component):
    settings = MagicMock(MODELS=[])
    monkeypatch.setattr(init_app, "get_settings", lambda: settings)
    monkeypatch.setattr(init_app, "_initialize_models_metadata", MagicMock())
    monkeypatch.setattr(init_app.ModelRegistry, "init_models", MagicMock())
    monkeypatch.setattr(init_app.PromptPool, "init", MagicMock())
    monkeypatch.setattr(init_app.RedisCache, "init_redis", AsyncMock())
    persistence_init = AsyncMock()
    monkeypatch.setattr(init_app.PersistanceHelpers, "init", persistence_init)
    files_init = AsyncMock()
    catalog_init = AsyncMock()
    {"files": files_init, "catalog": catalog_init}[
        failing_component
    ].side_effect = RuntimeError("document setup failed")
    monkeypatch.setattr(init_app.FileStoreManager, "init", files_init)
    monkeypatch.setattr(init_app.DocumentCatalogManager, "init", catalog_init)
    cleanup = AsyncMock()
    monkeypatch.setattr(init_app, "destroy_app", cleanup)

    with pytest.raises(RuntimeError, match="document setup failed"):
        await init_app.warmup_app()

    persistence_init.assert_awaited_once_with(settings)
    files_init.assert_awaited_once_with(settings)
    if failing_component == "catalog":
        catalog_init.assert_awaited_once_with(settings)
    else:
        catalog_init.assert_not_awaited()
    cleanup.assert_awaited_once()
