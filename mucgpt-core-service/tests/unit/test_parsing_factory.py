"""Tests for the document parser factory selection."""

from unittest.mock import MagicMock

import pytest

from config.settings import ParserBackendType
from parsing import factory
from parsing.xberg import XbergBackend


def _settings_with(monkeypatch: pytest.MonkeyPatch, backend: str) -> None:
    settings = factory.get_settings().model_copy(update={"parser_backend": backend})
    monkeypatch.setattr(factory, "get_settings", lambda: settings)


def test_none_backend_disables_parsing(monkeypatch):
    _settings_with(monkeypatch, ParserBackendType.NONE)

    assert factory.get_parser() is None


def test_xberg_backend_is_selected(monkeypatch):
    _settings_with(monkeypatch, ParserBackendType.XBERG)

    assert isinstance(factory.get_parser(), XbergBackend)


def test_unknown_backend_raises(monkeypatch):
    _settings_with(monkeypatch, MagicMock())

    with pytest.raises(ValueError, match="Unknown parser backend"):
        factory.get_parser()
