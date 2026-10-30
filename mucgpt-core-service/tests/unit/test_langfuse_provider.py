import pytest

import config.langfuse_provider as langfuse_provider_module
from config.langfuse_provider import LangfuseProvider

_real_init = LangfuseProvider.__dict__["init"]
_real_get_callback_handler = LangfuseProvider.__dict__["get_callback_handler"]


class _FakeLangfuse:
    last_release = None
    auth_error: Exception | None = None
    instances: list["_FakeLangfuse"] = []

    def __init__(self, **kwargs):
        self.release = kwargs.get("release")
        _FakeLangfuse.last_release = self.release
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
