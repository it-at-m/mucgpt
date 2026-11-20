from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from config.settings import PromptConfig, PromptFolderConfig, PromptPoolConfig
from core.lf_prompts import PromptPool
from core.llm_helpers import read_prompt_file


@pytest.fixture(autouse=True)
def reset_prompt_pool() -> None:
    PromptPool.init(None, PromptPoolConfig())


def test_local_prompts_are_used_without_langfuse() -> None:
    assert (
        PromptPool.get_prompt("default_instructions")
        == (PromptPool._defaults["default_instructions"])
    )
    assert PromptPool.get_prompt("chat_title") == PromptPool._defaults["chat_title"]


def test_get_prompt_uses_configured_folder_name_label_and_local_fallback() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="from langfuse")
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="/custom/",
                prompts=[
                    PromptConfig(name="default_instructions", label="staging"),
                ],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    result = PromptPool.get_prompt("default_instructions")

    assert result == "from langfuse"
    lf_client.get_prompt.assert_called_once_with(
        "custom/default_instructions",
        label="staging",
        fallback=PromptPool._defaults["default_instructions"],
    )


def test_configured_prompt_name_is_used_for_langfuse_and_local_fallback() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="remote prompt")
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="generation_prompts",
                prompts=[
                    PromptConfig(name="assistant_systemprompt", label="production")
                ],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("assistant_systemprompt") == "remote prompt"
    lf_client.get_prompt.assert_called_once_with(
        "generation_prompts/assistant_systemprompt",
        label="production",
        fallback=PromptPool._defaults["assistant_systemprompt"],
    )


def test_compliance_prompt_uses_category_as_langfuse_prompt_name() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="remote compliance")
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="compliance",
                prompts=[PromptConfig(name="education", label="production")],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("education") == "remote compliance"
    lf_client.get_prompt.assert_called_once_with(
        "compliance/education",
        label="production",
        fallback=PromptPool._defaults["education"],
    )


def test_resolved_prompt_retains_remote_prompt_metadata() -> None:
    lf_client = MagicMock()
    remote_prompt = SimpleNamespace(prompt="remote prompt", is_fallback=False)
    lf_client.get_prompt.return_value = remote_prompt
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="generation_prompts",
                prompts=[PromptConfig(name="assistant_name")],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    resolved = PromptPool.get_resolved_prompt("assistant_name")

    assert resolved.content == "remote prompt"
    assert resolved.langfuse_prompt is remote_prompt


def test_langfuse_error_uses_matching_local_prompt() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.side_effect = RuntimeError("unreachable")
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="defaults",
                prompts=[PromptConfig(name="default_instructions")],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert (
        PromptPool.get_prompt("default_instructions")
        == (PromptPool._defaults["default_instructions"])
    )


def test_unconfigured_prompt_uses_local_fallback_even_with_langfuse() -> None:
    lf_client = MagicMock()
    PromptPool.init(lf_client, PromptPoolConfig())

    assert (
        PromptPool.get_prompt("default_instructions")
        == PromptPool._defaults["default_instructions"]
    )
    lf_client.get_prompt.assert_not_called()


def test_configured_remote_only_prompt_does_not_invent_a_fallback() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="remote only")
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="generation_prompts",
                prompts=[PromptConfig(name="remote_only", label="production")],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("remote_only") == "remote only"
    lf_client.get_prompt.assert_called_once_with(
        "generation_prompts/remote_only",
        label="production",
        fallback=None,
    )


def test_configured_remote_only_prompt_without_local_file_uses_langfuse() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="remote only")
    config = PromptPoolConfig(
        folders=[
            PromptFolderConfig(
                name="generation_prompts",
                prompts=[PromptConfig(name="no_such_local_prompt", label="production")],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("no_such_local_prompt") == "remote only"
    lf_client.get_prompt.assert_called_once_with(
        "generation_prompts/no_such_local_prompt",
        label="production",
        fallback=None,
    )


def test_stem_lookup_resolves_prompt_from_subfolder_without_folder_name() -> None:
    lf_client = MagicMock()
    PromptPool.init(lf_client, PromptPoolConfig())

    assert (
        PromptPool.get_prompt("document_instructions")
        == PromptPool._defaults["document_instructions"]
    )
    lf_client.get_prompt.assert_not_called()


def test_unknown_prompt_raises_key_error() -> None:
    with pytest.raises(KeyError):
        PromptPool.get_prompt("nonexistent")


def test_read_prompt_file_unknown_filename_raises_http_500() -> None:
    with pytest.raises(HTTPException) as exc_info:
        read_prompt_file("nonexistent.md")

    assert exc_info.value.status_code == 500
