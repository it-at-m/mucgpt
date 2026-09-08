import pytest

from config.langfuse_provider import LangfuseProvider


@pytest.fixture(autouse=True)
def disable_langfuse(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep test runs independent from Langfuse credentials and services."""

    monkeypatch.setattr(LangfuseProvider, "_langfuse_callback", None)
    monkeypatch.setattr(LangfuseProvider, "init", staticmethod(lambda **_kwargs: None))
    monkeypatch.setattr(
        LangfuseProvider, "get_callback_handler", staticmethod(lambda: None)
    )
