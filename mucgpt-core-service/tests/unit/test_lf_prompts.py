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
    assert (
        PromptPool.get_prompt("prompt_for_chat_title")
        == (PromptPool._defaults["prompt_for_chat_title"])
    )


def test_get_prompt_uses_configured_folder_name_label_and_local_fallback() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="from langfuse")
    config = PromptPoolConfig(
        FOLDERS=[
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
        FOLDERS=[
            PromptFolderConfig(
                name="generation_prompts",
                prompts=[
                    PromptConfig(name="prompt_for_systemprompt", label="production")
                ],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("prompt_for_systemprompt") == "remote prompt"
    lf_client.get_prompt.assert_called_once_with(
        "generation_prompts/prompt_for_systemprompt",
        label="production",
        fallback=PromptPool._defaults["prompt_for_systemprompt"],
    )


def test_compliance_prompt_uses_category_as_langfuse_prompt_name() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.return_value = SimpleNamespace(prompt="remote compliance")
    config = PromptPoolConfig(
        FOLDERS=[
            PromptFolderConfig(
                name="compliance",
                prompts=[PromptConfig(name="education", label="production")],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("education", "compliance") == "remote compliance"
    lf_client.get_prompt.assert_called_once_with(
        "compliance/education",
        label="production",
        fallback=PromptPool._defaults["education"],
    )


def test_langfuse_error_uses_matching_local_prompt() -> None:
    lf_client = MagicMock()
    lf_client.get_prompt.side_effect = RuntimeError("unreachable")
    config = PromptPoolConfig(
        FOLDERS=[
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
        FOLDERS=[
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
        FOLDERS=[
            PromptFolderConfig(
                name="generation_prompts",
                prompts=[
                    PromptConfig(name="assistant_description", label="production")
                ],
            )
        ]
    )
    PromptPool.init(lf_client, config)

    assert PromptPool.get_prompt("assistant_description") == "remote only"
    lf_client.get_prompt.assert_called_once_with(
        "generation_prompts/assistant_description",
        label="production",
        fallback=None,
    )


def test_unknown_prompt_raises_key_error() -> None:
    with pytest.raises(KeyError):
        PromptPool.get_prompt("nonexistent")


def test_read_prompt_file_unknown_filename_raises_http_500() -> None:
    with pytest.raises(HTTPException) as exc_info:
        read_prompt_file("nonexistent.md")

    assert exc_info.value.status_code == 500
