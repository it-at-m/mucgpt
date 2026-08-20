from unittest.mock import MagicMock

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
        type="OPENAI",
        llm_name="test-model",
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
        type="AZURE", llm_name="test-model", deep_agent=DeepAgentModelConfig()
    )

    register_model_harness_profile(model_config)

    assert register_profile.call_args.args[0] == "azure:test-model"


def test_profile_summarizer_replaces_deep_agents_default(monkeypatch) -> None:
    register_profile = MagicMock()
    summary_model = MagicMock(profile={"max_input_tokens": 128_000})
    monkeypatch.setattr(
        "config.harness_profiles.register_harness_profile", register_profile
    )
    monkeypatch.setattr(
        "config.harness_profiles.ModelRegistry.get_model", lambda: summary_model
    )
    model_config = ModelsConfig.model_construct(
        type="OPENAI",
        llm_name="test-model",
        deep_agent=DeepAgentModelConfig(
            enabled_builtin_tools={"read_file", "write_file", "edit_file"},
            enable_summarization=True,
        ),
    )

    register_model_harness_profile(model_config)

    _, profile = register_profile.call_args.args
    assert isinstance(profile.extra_middleware[0], ProfileSummarizationMiddleware)
    assert profile.excluded_middleware
