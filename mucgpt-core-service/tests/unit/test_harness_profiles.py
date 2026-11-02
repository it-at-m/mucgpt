from unittest.mock import MagicMock

import pytest
from deepagents.middleware import SummarizationMiddleware

from config.harness_profiles import (
    DEEP_AGENT_BUILTIN_TOOLS,
    ProfileSummarizationMiddleware,
    register_model_harness_profile,
)
from config.settings import DeepAgentModelConfig, ModelsConfig


def test_registers_model_specific_builtin_tool_profile(monkeypatch) -> None:
    register_profile = MagicMock()
    monkeypatch.setattr(
        "config.harness_profiles.register_harness_profile", register_profile
    )
    model_config = ModelsConfig.model_construct(
        type="openai",
        id="test-model",
        deep_agent=DeepAgentModelConfig(enabled_builtin_tools={"write_todos"}),
    )

    register_model_harness_profile(model_config)

    key, profile = register_profile.call_args.args
    assert key == "openai:test-model"
    assert profile.excluded_tools == DEEP_AGENT_BUILTIN_TOOLS - {"write_todos"}
    assert profile.general_purpose_subagent.enabled is False
    assert len(profile.extra_middleware) == 1
    assert profile.extra_middleware[0].name == "TodoListMiddleware"


def test_registers_azure_model_profile_with_azure_provider_key(monkeypatch) -> None:
    register_profile = MagicMock()
    monkeypatch.setattr(
        "config.harness_profiles.register_harness_profile", register_profile
    )
    model_config = ModelsConfig.model_construct(
        type="azure", id="test-model", deep_agent=DeepAgentModelConfig()
    )

    register_model_harness_profile(model_config)

    assert register_profile.call_args.args[0] == "azure:test-model"


@pytest.mark.parametrize(
    "enabled_tools",
    [
        set(),
        {"read_file", "grep"},
        {"write_todos"},
        {"read_file", "write_file", "edit_file"},
    ],
)
def test_profile_summarizer_replaces_deep_agents_default(
    monkeypatch, enabled_tools
) -> None:
    register_profile = MagicMock()
    summary_model = MagicMock(profile={"max_input_tokens": 128_000})
    monkeypatch.setattr(
        "config.harness_profiles.register_harness_profile", register_profile
    )
    monkeypatch.setattr(
        "config.harness_profiles.ModelRegistry.get_model", lambda: summary_model
    )
    model_config = ModelsConfig.model_construct(
        type="openai",
        id="test-model",
        deep_agent=DeepAgentModelConfig(
            enabled_builtin_tools=enabled_tools,
            enable_summarization=True,
        ),
    )

    register_model_harness_profile(model_config)

    _, profile = register_profile.call_args.args
    assert isinstance(profile.extra_middleware[0], ProfileSummarizationMiddleware)
    assert profile.excluded_middleware == frozenset({SummarizationMiddleware})
    assert profile.excluded_tools == DEEP_AGENT_BUILTIN_TOOLS - enabled_tools


@pytest.mark.parametrize("enable_summarization", [False, None])
def test_disabled_summarization_does_not_construct_or_enable_a_summarizer(
    monkeypatch, enable_summarization
) -> None:
    register_profile = MagicMock()
    get_model = MagicMock(
        side_effect=AssertionError("summary model must not be loaded")
    )
    monkeypatch.setattr(
        "config.harness_profiles.register_harness_profile", register_profile
    )
    monkeypatch.setattr("config.harness_profiles.ModelRegistry.get_model", get_model)
    model_config = ModelsConfig.model_construct(
        type="OPENAI",
        llm_name="test-model",
        deep_agent=DeepAgentModelConfig(
            enabled_builtin_tools={"read_file", "grep"},
            enable_summarization=enable_summarization,
        ),
    )

    register_model_harness_profile(model_config)

    _, profile = register_profile.call_args.args
    assert profile.extra_middleware == ()
    assert profile.excluded_middleware == frozenset({SummarizationMiddleware})
    assert profile.excluded_tools == DEEP_AGENT_BUILTIN_TOOLS - {"read_file", "grep"}
    get_model.assert_not_called()
