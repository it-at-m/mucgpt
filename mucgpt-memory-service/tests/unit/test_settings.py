import pytest

from config.settings import ParserBackendType, Settings, get_settings


@pytest.mark.unit
def test_defaults(monkeypatch):
    """Settings should carry sensible defaults (isolated from pytest-env overrides)."""
    monkeypatch.delenv("LOG_CONFIG", raising=False)
    monkeypatch.delenv("KREUZBERG_URL", raising=False)
    monkeypatch.delenv("PARSER_BACKEND", raising=False)
    s = Settings()
    assert s.PARSER_BACKEND == ParserBackendType.KREUZBERG
    assert s.KREUZBERG_TIMEOUT == 120.0
    assert s.LOG_CONFIG == "logconf.yaml"
    assert s.APP_VERSION == "unknown"


@pytest.mark.unit
def test_parser_backend_from_env(monkeypatch):
    """PARSER_BACKEND env var should be picked up by Settings."""
    monkeypatch.setenv("PARSER_BACKEND", "kreuzberg")
    s = Settings()
    assert s.PARSER_BACKEND == ParserBackendType.KREUZBERG


@pytest.mark.unit
def test_invalid_parser_backend_raises(monkeypatch):
    """An unknown PARSER_BACKEND value should fail Pydantic validation."""
    from pydantic import ValidationError

    monkeypatch.setenv("PARSER_BACKEND", "totally_unknown")
    with pytest.raises(ValidationError):
        Settings()


@pytest.mark.unit
def test_kreuzberg_url_from_env(monkeypatch):
    """KREUZBERG_URL should be read from the environment."""
    monkeypatch.setenv("KREUZBERG_URL", "http://myhost:1234")
    s = Settings()
    assert s.KREUZBERG_URL == "http://myhost:1234"


@pytest.mark.unit
def test_get_settings_is_cached():
    """get_settings() should return the same instance on repeated calls."""
    assert get_settings() is get_settings()
