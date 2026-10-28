from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain.agents.middleware import ModelRequest, ModelResponse
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.runtime import Runtime

from agent.middleware import (
    ContextMiddleware,
    RequestContext,
    TokenUsage,
    TokenUsageMiddleware,
)
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import ModelsConfig

CURRENT_DATE = "2026-10-06"
CURRENT_WEEKDAY = "Tuesday"


def _initialize_model(config: ModelsConfig, monkeypatch: pytest.MonkeyPatch):
    for field in (
        "_models",
        "_default_model",
        "_reasoning_models",
        "_supported_reasoning_efforts",
        "_default_reasoning_efforts",
        "_fallback_reasoning_effort",
        "_models_without_temperature",
    ):
        monkeypatch.setattr(ModelRegistry, field, getattr(ModelRegistry, field))
    ModelRegistry.init_models([config])
    return ModelRegistry.get_model(config.llm_name)


def _freeze_current_date(monkeypatch: pytest.MonkeyPatch) -> None:
    mocked_datetime = MagicMock()
    mocked_datetime.now.return_value.date.return_value.weekday.return_value = 1
    mocked_datetime.now.return_value.date.return_value.isoformat.return_value = (
        CURRENT_DATE
    )
    monkeypatch.setattr("agent.middleware.datetime", mocked_datetime)


@tool
def first_tool() -> str:
    """Return the first test result."""
    return "first"


@tool
def second_tool() -> str:
    """Return the second test result."""
    return "second"


def _model_request(context: RequestContext | None) -> ModelRequest:
    return ModelRequest(
        model=FakeListChatModel(responses=["bootstrap"]),
        messages=[],
        tools=[first_tool, second_tool],
        state={},
        runtime=Runtime(context=context),
        model_settings={"existing": "value"},
    )


def test_wrap_model_call_selects_model_and_applies_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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


def test_wrap_model_call_adds_current_date_to_system_message(monkeypatch) -> None:
    _freeze_current_date(monkeypatch)
    selected_model = FakeListChatModel(responses=["selected"])
    monkeypatch.setattr(ModelRegistry, "get_model", lambda _name=None: selected_model)
    request = _model_request(RequestContext())
    request = request.override(system_message=SystemMessage(content="Instructions"))
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(request, handler)

    system_message = handler.call_args.args[0].system_message
    assert isinstance(system_message, SystemMessage)
    assert system_message.content == (
        "Instructions\n\nCurrent date (Europe/Berlin): "
        f"{CURRENT_WEEKDAY}, {CURRENT_DATE}"
    )


def test_wrap_model_call_adds_date_without_request_context(monkeypatch) -> None:
    _freeze_current_date(monkeypatch)
    selected_model = FakeListChatModel(responses=["selected"])
    monkeypatch.setattr(ModelRegistry, "get_model", lambda _name=None: selected_model)
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(_model_request(None), handler)

    system_message = handler.call_args.args[0].system_message
    assert isinstance(system_message, SystemMessage)
    assert system_message.content == (
        f"Current date (Europe/Berlin): {CURRENT_WEEKDAY}, {CURRENT_DATE}"
    )


def test_wrap_model_call_filters_tools_from_request_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ModelRegistry,
        "get_model",
        lambda _name=None: FakeListChatModel(responses=["selected"]),
    )
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(
        _model_request(RequestContext(enabled_tools=["first_tool"])), handler
    )

    assert handler.call_args.args[0].tools == [first_tool]


def test_wrap_model_call_preserves_deep_agent_builtin_tools(monkeypatch) -> None:
    monkeypatch.setattr(
        ModelRegistry,
        "get_model",
        lambda _name=None: FakeListChatModel(responses=["selected"]),
    )
    builtin_tool = first_tool.model_copy(update={"name": "write_todos"})
    request = _model_request(RequestContext(enabled_tools=[]))
    request = request.override(tools=[builtin_tool, second_tool])
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(request, handler)

    assert handler.call_args.args[0].tools == [builtin_tool]


@pytest.mark.asyncio
async def test_awrap_model_call_filters_tools_from_request_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ModelRegistry,
        "get_model",
        lambda _name=None: FakeListChatModel(responses=["selected"]),
    )
    handler = AsyncMock(return_value=ModelResponse(result=[]))

    await ContextMiddleware().awrap_model_call(
        _model_request(RequestContext(enabled_tools=["second_tool"])), handler
    )

    assert handler.call_args.args[0].tools == [second_tool]


@pytest.mark.asyncio
async def test_awrap_model_call_matches_sync_selection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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


def test_wrap_model_call_omits_unsupported_temperature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _initialize_model(
        ModelsConfig(
            type="OPENAI",
            llm_name="gpt-6",
            endpoint="https://example.test",
            api_key="test",
            model_info={"supports_temperature": False},
        ),
        monkeypatch,
    )
    handler = MagicMock(return_value=ModelResponse(result=[]))

    ContextMiddleware().wrap_model_call(
        _model_request(
            RequestContext(model_name="gpt-6", temperature=0.2, stream=True)
        ),
        handler,
    )

    configured_request = handler.call_args.args[0]
    assert "temperature" not in configured_request.model_settings
    assert configured_request.model_settings["stream"] is True


@pytest.mark.parametrize("include_total", [True, False])
def test_token_usage_details_do_not_change_totals(include_total: bool) -> None:
    usage = TokenUsage()
    metadata = {
        "input_tokens": 17763,
        "output_tokens": 1875,
        "input_token_details": {"cache_read": 2845},
        "output_token_details": {"reasoning": 137},
    }
    if include_total:
        metadata["total_tokens"] = 19638
    usage.add(metadata)
    assert usage.prompt_tokens == 17763
    assert usage.completion_tokens == 1875
    assert usage.context_tokens == 19638
    assert usage.cache_read_tokens == 2845
    assert usage.reasoning_tokens == 137
    usage.add({"input_tokens": 10, "output_tokens": 2})
    assert usage.prompt_tokens == 17773
    assert usage.completion_tokens == 1877
    assert usage.context_tokens == 12
    assert usage.cache_read_tokens == 2845


@pytest.mark.asyncio
@pytest.mark.parametrize("async_call", [False, True], ids=["sync", "async"])
async def test_token_usage_middleware_accumulates_calls_and_keeps_latest_context(
    async_call: bool,
) -> None:
    token_usage = TokenUsage()
    request = _model_request(RequestContext(token_usage=token_usage))
    middleware = TokenUsageMiddleware()

    for input_tokens, output_tokens in ((10, 2), (20, 4)):
        response = ModelResponse(
            result=[
                AIMessage(
                    content="response",
                    usage_metadata={
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": input_tokens + output_tokens,
                    },
                )
            ]
        )
        if async_call:
            handler = AsyncMock(return_value=response)
            result = await middleware.awrap_model_call(request, handler)
            handler.assert_awaited_once_with(request)
        else:
            handler = MagicMock(return_value=response)
            result = middleware.wrap_model_call(request, handler)
            handler.assert_called_once_with(request)
        assert result is response

    assert token_usage.prompt_tokens == 30
    assert token_usage.completion_tokens == 6
    assert token_usage.context_tokens == 24


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
    assert model.store is False
    assert model._should_stream(async_api=True, stream=True) is True
    assert model._should_stream(async_api=True, stream=False) is False


def test_azure_model_alias_uses_configured_temperature_capability(monkeypatch) -> None:
    config = ModelsConfig(
        type="AZURE",
        llm_name="gpt-5",
        deployment="production-chat",
        endpoint="https://example.openai.azure.com",
        api_key="test",
        api_version="2025-04-01-preview",
        model_info={
            "auto_enrich_from_model_info_endpoint": False,
            "max_output_tokens": 128_000,
            "max_input_tokens": 272_000,
            "description": "GPT-5 Azure test model",
            "supports_temperature": False,
        },
    )

    model = _initialize_model(config, monkeypatch)
    settings = ModelRegistry.normalize_model_settings(
        model, {"temperature": 0.2, "stream": True}
    )

    assert model.model_name == "gpt-5"
    assert model.deployment_name == "production-chat"
    assert settings == {"stream": True}


@pytest.mark.parametrize("model_name", ["gpt-6", "gpt-5", "custom-proxy-model"])
@pytest.mark.parametrize("supports_temperature", [True, False, None])
def test_temperature_filtering_is_configuration_driven(
    monkeypatch, model_name, supports_temperature
) -> None:
    model_info = {"supports_reasoning": False}
    if supports_temperature is not None:
        model_info["supports_temperature"] = supports_temperature
    model = _initialize_model(
        ModelsConfig(
            type="OPENAI",
            llm_name=model_name,
            endpoint="https://example.test",
            api_key="test",
            model_info=model_info,
        ),
        monkeypatch,
    )
    original = {"temperature": 0.4, "stream": False, "reasoning_effort": "low"}

    normalized = ModelRegistry.normalize_model_settings(model, original)

    expected = dict(original)
    expected.pop("reasoning_effort")
    if supports_temperature is False:
        expected.pop("temperature")
    assert normalized == expected
    assert original["temperature"] == 0.4
    assert ModelRegistry.get_model() is model


def test_reasoning_models_omit_temperature_and_keep_reasoning_effort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = _initialize_model(
        ModelsConfig(
            type="OPENAI",
            llm_name="reasoning-model",
            endpoint="https://example.test",
            api_key="test",
            model_info={
                "supports_reasoning": True,
                "supports_temperature": True,
            },
        ),
        monkeypatch,
    )

    normalized = ModelRegistry.normalize_model_settings(
        model,
        {"temperature": 0.4, "stream": False, "reasoning_effort": "low"},
    )

    assert normalized == {"stream": False, "reasoning_effort": "low"}


def _reasoning_model(monkeypatch: pytest.MonkeyPatch, **reasoning_info):
    return _initialize_model(
        ModelsConfig(
            type="OPENAI",
            llm_name="reasoning-model",
            endpoint="https://example.test",
            api_key="test",
            model_info={"supports_reasoning": True, **reasoning_info},
        ),
        monkeypatch,
    )


@pytest.mark.parametrize(
    ("reasoning_info", "expected"),
    [
        ({}, "low"),
        ({"default_reasoning_effort": "medium"}, "medium"),
        ({"supported_reasoning_efforts": ["medium", "high"]}, "medium"),
        (
            {
                "supported_reasoning_efforts": ["low", "medium"],
                "default_reasoning_effort": "high",
            },
            "medium",
        ),
    ],
)
def test_reasoning_effort_defaults_when_not_requested(
    monkeypatch: pytest.MonkeyPatch, reasoning_info, expected
) -> None:
    model = _reasoning_model(monkeypatch, **reasoning_info)

    for settings in ({"stream": False}, {"stream": False, "reasoning_effort": None}):
        normalized = ModelRegistry.normalize_model_settings(model, settings)
        assert normalized == {"stream": False, "reasoning_effort": expected}


@pytest.mark.parametrize(
    ("supported", "requested", "expected"),
    [
        (["low", "medium", "high"], "none", "low"),
        (["low", "medium", "high"], "minimal", "low"),
        (["low", "medium", "high"], "medium", "medium"),
        (["none", "low", "medium", "high"], "none", "none"),
        (["none", "low"], "minimal", "low"),
        (["high"], "none", "high"),
        (["none", "minimal"], "high", "minimal"),
    ],
)
def test_reasoning_effort_clamped_to_supported_efforts(
    monkeypatch: pytest.MonkeyPatch, supported, requested, expected
) -> None:
    model = _reasoning_model(monkeypatch, supported_reasoning_efforts=supported)

    normalized = ModelRegistry.normalize_model_settings(
        model, {"reasoning_effort": requested}
    )

    assert normalized == {"reasoning_effort": expected}


@pytest.mark.parametrize(
    ("fallback", "reasoning_info", "expected"),
    [
        ("medium", {}, {"reasoning_effort": "medium"}),
        (
            "none",
            {"supported_reasoning_efforts": ["low", "high"]},
            {"reasoning_effort": "low"},
        ),
        ("high", {"default_reasoning_effort": "low"}, {"reasoning_effort": "low"}),
        (None, {}, {}),
        (None, {"supported_reasoning_efforts": ["low", "high"]}, {}),
    ],
)
def test_configured_fallback_reasoning_effort(
    monkeypatch: pytest.MonkeyPatch, fallback, reasoning_info, expected
) -> None:
    # Snapshot registry state, then re-initialize with the configured fallback.
    _reasoning_model(monkeypatch, **reasoning_info)
    ModelRegistry.init_models(
        [
            ModelsConfig(
                type="OPENAI",
                llm_name="reasoning-model",
                endpoint="https://example.test",
                api_key="test",
                model_info={"supports_reasoning": True, **reasoning_info},
            )
        ],
        fallback_reasoning_effort=fallback,
    )
    model = ModelRegistry.get_model("reasoning-model")

    assert ModelRegistry.normalize_model_settings(model, {}) == expected


def test_reasoning_effort_passes_through_without_supported_efforts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = _reasoning_model(monkeypatch, default_reasoning_effort="medium")

    normalized = ModelRegistry.normalize_model_settings(
        model, {"reasoning_effort": "none"}
    )

    assert normalized == {"reasoning_effort": "none"}


def test_model_without_reasoning_info_never_gets_reasoning_effort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = _initialize_model(
        ModelsConfig(
            type="OPENAI",
            llm_name="gpt-4.1-mini",
            endpoint="https://example.test",
            api_key="test",
            model_info={
                "supported_reasoning_efforts": ["low"],
                "default_reasoning_effort": "low",
            },
        ),
        monkeypatch,
    )

    assert ModelRegistry.normalize_model_settings(model, {"temperature": 0.4}) == {
        "temperature": 0.4
    }
    assert ModelRegistry.normalize_model_settings(
        model, {"temperature": 0.4, "reasoning_effort": "high"}
    ) == {"temperature": 0.4}


def test_reinitializing_registry_resets_temperature_capability(monkeypatch) -> None:
    config = ModelsConfig(
        type="OPENAI",
        llm_name="custom-proxy-model",
        endpoint="https://example.test",
        api_key="test",
        model_info={"supports_temperature": False},
    )
    model = _initialize_model(config, monkeypatch)
    assert ModelRegistry.normalize_model_settings(model, {"temperature": 0.4}) == {}

    config.model_info.supports_temperature = True
    ModelRegistry.init_models([config])

    assert ModelRegistry.normalize_model_settings(
        ModelRegistry.get_model(), {"temperature": 0.4}
    ) == {"temperature": 0.4}


def test_model_registry_uses_default_and_rejects_unknown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    default_model = FakeListChatModel(responses=["default"])
    monkeypatch.setattr(ModelRegistry, "_models", {"default": default_model})
    monkeypatch.setattr(ModelRegistry, "_default_model", default_model)

    assert ModelRegistry.get_model() is default_model
    with pytest.raises(ModelsConfigurationException, match="missing"):
        ModelRegistry.get_model("missing")
