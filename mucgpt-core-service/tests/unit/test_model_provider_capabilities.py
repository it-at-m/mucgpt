"""Capability flags for strict OpenAI-compatible providers (Mistral, …)."""

import pytest
from langchain_openai import ChatOpenAI

from config.model_provider import ModelRegistry
from config.settings import ModelsConfig


def _config(**model_info) -> ModelsConfig:
    return ModelsConfig(
        type="openai",
        id="cap-model",
        endpoint="https://provider.example/v1",
        api_key="sk-test",
        model_info=model_info,
    )


def _init_registry(config: ModelsConfig, monkeypatch: pytest.MonkeyPatch) -> ChatOpenAI:
    for field in (
        "_models",
        "_default_model",
        "_reasoning_models",
        "_supported_reasoning_efforts",
        "_default_reasoning_efforts",
        "_fallback_reasoning_effort",
        "_models_without_temperature",
        "_models_without_user",
    ):
        monkeypatch.setattr(ModelRegistry, field, getattr(ModelRegistry, field))
    ModelRegistry.init_models([config])
    return ModelRegistry.get_model(config.id)


class TestNormalize:
    def test_default_model_keeps_temperature_and_user(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        model = _init_registry(_config(), monkeypatch)
        settings = ModelRegistry.normalize_model_settings(
            model, {"temperature": 0.0, "user": "TEAM", "stream": False}
        )
        assert settings["temperature"] == 0.0
        assert settings["user"] == "TEAM"

    def test_capability_flags_strip_rejected_fields(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        model = _init_registry(
            _config(
                supports_temperature=False,
                supports_user_param=False,
            ),
            monkeypatch,
        )
        settings = ModelRegistry.normalize_model_settings(
            model, {"temperature": 0.0, "user": "TEAM", "stream": False}
        )
        assert "temperature" not in settings
        assert "user" not in settings
        assert settings["stream"] is False


class TestStorePrivacyGuard:
    def test_store_false_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        model = _init_registry(_config(), monkeypatch)
        assert model.store is False

    def test_store_omitted_for_providers_rejecting_the_field(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        model = _init_registry(_config(supports_store_param=False), monkeypatch)
        assert model.store is None
