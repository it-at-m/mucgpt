from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain.agents.middleware import ModelRequest, ModelResponse
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_openai import ChatOpenAI
from langgraph.runtime import Runtime

from agent.middleware import ContextMiddleware, RequestContext
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import ModelsConfig


def _model_request(context: RequestContext | None) -> ModelRequest:
    return ModelRequest(
        model=FakeListChatModel(responses=["bootstrap"]),
        messages=[],
        tools=[],
        state={},
        runtime=Runtime(context=context),
        model_settings={"existing": "value"},
    )


def test_wrap_model_call_selects_model_and_applies_settings(monkeypatch) -> None:
    selected_model = FakeListChatModel(responses=["selected"])
    get_model = MagicMock(return_value=selected_model)
    monkeypatch.setattr(ModelRegistry, "get_model", get_model)
    context = RequestContext(
        model_name="selected-model",
        temperature=0.2,
        stream=True,
        user="POR",
        extra_body={"metadata": {"tags": ["assistant-1"]}},
        assistant_id="assistant-1",
    )
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(_model_request(context), handler)

    configured_request = handler.call_args.args[0]
    get_model.assert_called_once_with("selected-model")
    assert configured_request.model is selected_model
    assert configured_request.model_settings == {
        "existing": "value",
        "temperature": 0.2,
        "stream": True,
        "user": "POR",
        "extra_body": {"metadata": {"tags": ["assistant-1"]}},
    }


@pytest.mark.asyncio
async def test_awrap_model_call_matches_sync_selection(monkeypatch) -> None:
    selected_model = FakeListChatModel(responses=["selected"])
    monkeypatch.setattr(ModelRegistry, "get_model", lambda _name=None: selected_model)
    handler = AsyncMock(return_value=ModelResponse(result=[]))

    await ContextMiddleware().awrap_model_call(
        _model_request(RequestContext(model_name="selected-model")), handler
    )

    configured_request = handler.call_args.args[0]
    assert configured_request.model is selected_model
    assert configured_request.model_settings["temperature"] == 0.5
    assert configured_request.model_settings["stream"] is False


def test_wrap_model_call_omits_unsupported_temperature(monkeypatch) -> None:
    selected_model = ChatOpenAI(model="gpt-5", api_key="test")
    monkeypatch.setattr(ModelRegistry, "get_model", lambda _name=None: selected_model)
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(
        _model_request(
            RequestContext(model_name="gpt-5", temperature=0.2, stream=True)
        ),
        handler,
    )

    configured_request = handler.call_args.args[0]
    assert "temperature" not in configured_request.model_settings
    assert configured_request.model_settings["stream"] is True


def test_normalize_model_settings_preserves_unknown_model_temperature() -> None:
    model = ChatOpenAI(model="custom-proxy-model", api_key="test")

    settings = ModelRegistry.normalize_model_settings(
        model, {"temperature": 0.4, "stream": False}
    )

    assert settings == {"temperature": 0.4, "stream": False}


def test_initialized_model_uses_request_scoped_streaming_and_temperature() -> None:
    config = ModelsConfig(
        type="OPENAI",
        llm_name="gpt-5",
        endpoint="https://example.test",
        api_key="test",
        model_info={
            "auto_enrich_from_model_info_endpoint": False,
            "max_output_tokens": 128_000,
            "max_input_tokens": 272_000,
            "description": "GPT-5 test model",
        },
    )

    model = ModelRegistry.init_chat_model(config)

    assert "streaming" not in model.model_fields_set
    assert "temperature" not in model.model_fields_set
    assert model._should_stream(async_api=True, stream=True) is True
    assert model._should_stream(async_api=True, stream=False) is False


def test_model_registry_uses_default_and_rejects_unknown(monkeypatch) -> None:
    default_model = FakeListChatModel(responses=["default"])
    monkeypatch.setattr(ModelRegistry, "_models", {"default": default_model})
    monkeypatch.setattr(ModelRegistry, "_default_model", default_model)

    assert ModelRegistry.get_model() is default_model
    with pytest.raises(ModelsConfigurationException, match="missing"):
        ModelRegistry.get_model("missing")
