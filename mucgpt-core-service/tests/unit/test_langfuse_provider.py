import os
from types import SimpleNamespace

import pytest

import config.langfuse_provider as langfuse_provider_module
from config.langfuse_provider import LangfuseProvider

_real_init = LangfuseProvider.__dict__["init"]
_real_get_callback_handler = LangfuseProvider.__dict__["get_callback_handler"]


def _settings_with(media_enabled: bool):
    return SimpleNamespace(
        image_input=SimpleNamespace(langfuse_media_enabled=media_enabled)
    )


class _FakeLangfuse:
    last_release = None
    last_kwargs: dict = {}
    auth_error: Exception | None = None
    instances: list["_FakeLangfuse"] = []

    def __init__(self, **kwargs):
        self.release = kwargs.get("release")
        self.kwargs = kwargs
        self.media_upload_env = os.environ.get("LANGFUSE_MEDIA_UPLOAD_ENABLED")
        _FakeLangfuse.last_release = self.release
        _FakeLangfuse.last_kwargs = kwargs
        _FakeLangfuse.instances.append(self)

    def auth_check(self) -> None:
        if _FakeLangfuse.auth_error is not None:
            raise _FakeLangfuse.auth_error


class _FakeCallbackHandler:
    pass


@pytest.fixture(autouse=True)
def _restore_real_init(monkeypatch: pytest.MonkeyPatch):
    """Undo the conftest-wide init stub so the real implementation is tested."""
    monkeypatch.setattr(LangfuseProvider, "init", _real_init)
    monkeypatch.setattr(
        LangfuseProvider, "get_callback_handler", _real_get_callback_handler
    )
    monkeypatch.setattr(
        langfuse_provider_module,
        "get_client",
        lambda: _FakeLangfuse(release=os.environ.get("LANGFUSE_RELEASE")),
    )
    monkeypatch.setattr(langfuse_provider_module, "Langfuse", _FakeLangfuse)
    monkeypatch.setattr(
        langfuse_provider_module, "CallbackHandler", _FakeCallbackHandler
    )
    _FakeLangfuse.instances.clear()
    _FakeLangfuse.auth_error = None
    LangfuseProvider._langfuse_callback = None
    yield
    LangfuseProvider._langfuse_callback = None


def test_init_disabled_without_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)

    assert LangfuseProvider.init(version="1.0.0") is None
    assert _FakeLangfuse.instances == []
    assert LangfuseProvider.get_callback_handler() is None


def test_init_uses_standard_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    monkeypatch.delenv("LANGFUSE_RELEASE", raising=False)

    client = LangfuseProvider.init(version="1.2.3")

    assert client is not None
    assert _FakeLangfuse.last_release == "1.2.3"
    assert isinstance(LangfuseProvider.get_callback_handler(), _FakeCallbackHandler)


def test_init_returns_none_on_auth_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    _FakeLangfuse.auth_error = RuntimeError("invalid credentials")

    assert LangfuseProvider.init(version="1.0.0") is None
    assert LangfuseProvider.get_callback_handler() is None


def test_media_tracing_disabled_forces_env_off_and_configures_masks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Default mode: no image bytes may reach Langfuse."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    # An inherited SDK value must not override the MUCGPT policy.
    monkeypatch.setenv("LANGFUSE_MEDIA_UPLOAD_ENABLED", "true")
    monkeypatch.setattr(
        langfuse_provider_module, "get_settings", lambda: _settings_with(False)
    )

    LangfuseProvider.init(version="1.0.0")

    assert _FakeLangfuse.last_kwargs["mask"] is not None
    assert _FakeLangfuse.last_kwargs["mask_otel_spans"] is not None
    # The forced env must be in effect before the client is constructed.
    assert _FakeLangfuse.instances[-1].media_upload_env == "false"
    assert os.environ["LANGFUSE_MEDIA_UPLOAD_ENABLED"] == "false"

    # The SDK mask redacts structured image payloads end to end.
    masked = _FakeLangfuse.last_kwargs["mask"](
        data={
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What does this show?"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,AAAA", "detail": "auto"
                            },
                        },
                    ],
                }
            ]
        }
    )
    assert "base64,AAAA" not in str(masked)
    assert "What does this show?" in str(masked)


def test_media_tracing_enabled_forces_env_on_without_masks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    # An inherited SDK value must not override the MUCGPT policy either way.
    monkeypatch.setenv("LANGFUSE_MEDIA_UPLOAD_ENABLED", "false")
    monkeypatch.setattr(
        langfuse_provider_module, "get_settings", lambda: _settings_with(True)
    )

    LangfuseProvider.init(version="1.0.0")

    assert os.environ["LANGFUSE_MEDIA_UPLOAD_ENABLED"] == "true"
    assert _FakeLangfuse.instances[-1].media_upload_env == "true"
    assert "mask" not in _FakeLangfuse.last_kwargs
    assert "mask_otel_spans" not in _FakeLangfuse.last_kwargs


def test_media_env_forced_even_without_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    monkeypatch.setenv("LANGFUSE_MEDIA_UPLOAD_ENABLED", "true")
    monkeypatch.setattr(
        langfuse_provider_module, "get_settings", lambda: _settings_with(False)
    )

    assert LangfuseProvider.init(version="1.0.0") is None

    assert os.environ["LANGFUSE_MEDIA_UPLOAD_ENABLED"] == "false"
