import pytest

from parsing.factory import get_parser
from parsing.kreuzberg import KreuzbergBackend


@pytest.mark.unit
def test_get_parser_returns_kreuzberg_backend():
    """get_parser() should return a KreuzbergBackend when PARSER_BACKEND=kreuzberg."""
    parser = get_parser()
    assert isinstance(parser, KreuzbergBackend)


@pytest.mark.unit
def test_get_parser_raises_on_unknown_backend(monkeypatch):
    """get_parser() should raise ValueError for an unrecognised backend type."""
    from unittest.mock import MagicMock

    fake_settings = MagicMock()
    fake_settings.PARSER_BACKEND = "does_not_exist"

    monkeypatch.setattr("parsing.factory.get_settings", lambda: fake_settings)

    with pytest.raises(ValueError, match="does_not_exist"):
        get_parser()
