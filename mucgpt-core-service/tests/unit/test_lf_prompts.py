from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from core.lf_prompts import PromptPool
from core.llm_helpers import read_prompt_file


def test_defaults_are_loaded_eagerly_without_init() -> None:
    assert "default_instructions" in PromptPool._defaults
    assert PromptPool._defaults["default_instructions"]


def test_get_prompt_without_langfuse_client_returns_local_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(PromptPool, "_lf_client", None)

    assert PromptPool.get_prompt("default_instructions") == (
        PromptPool._defaults["default_instructions"]
    )


def test_get_prompt_uses_langfuse_client_with_local_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    default_text = PromptPool._defaults["default_instructions"]
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = MagicMock(prompt="from langfuse")
    monkeypatch.setattr(PromptPool, "_lf_client", lf_client)

    result = PromptPool.get_prompt("default_instructions")

    assert result == "from langfuse"
    lf_client.get_prompt.assert_called_once_with(
        "default_instructions",
        fallback=default_text,
        max_retries=1,
        fetch_timeout_seconds=2,
    )


def test_get_prompt_falls_back_to_local_default_on_langfuse_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.side_effect = RuntimeError("unreachable")
    monkeypatch.setattr(PromptPool, "_lf_client", lf_client)

    assert PromptPool.get_prompt("default_instructions") == (
        PromptPool._defaults["default_instructions"]
    )


def test_get_prompt_unknown_name_raises_key_error() -> None:
    with pytest.raises(KeyError):
        PromptPool.get_prompt("nonexistent")


def test_init_primes_langfuse_cache_for_every_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lf_client = MagicMock()

    PromptPool.init(lf_client)

    assert lf_client.get_prompt.call_count == len(PromptPool._defaults)
    for name in PromptPool._defaults:
        lf_client.get_prompt.assert_any_call(
            name, max_retries=1, fetch_timeout_seconds=2
        )


def test_init_without_client_still_leaves_local_defaults_usable() -> None:
    PromptPool.init(None)

    assert PromptPool.get_prompt("default_instructions") == (
        PromptPool._defaults["default_instructions"]
    )


def test_read_prompt_file_unknown_filename_raises_http_500() -> None:
    with pytest.raises(HTTPException) as exc_info:
        read_prompt_file("nonexistent.md")

    assert exc_info.value.status_code == 500
