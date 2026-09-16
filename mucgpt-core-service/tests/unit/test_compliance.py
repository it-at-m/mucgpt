from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from core.auth_models import AuthenticationResult
from core.compliance import _check_category, read_prompt_file_with_metadata
from core.lf_prompts import ResolvedPrompt


@pytest.mark.unit
@pytest.mark.asyncio
async def test_category_check_resolves_prompt_by_category_name() -> None:
    parsed = SimpleNamespace(verdict="passed", reasoning=None)
    prompt = ResolvedPrompt(content="instruction", langfuse_prompt=object())

    with (
        patch(
            "core.compliance.asyncio.to_thread", AsyncMock(return_value=prompt)
        ) as to_thread,
        patch(
            "core.compliance.invoke_internal_structured_generation",
            AsyncMock(return_value=parsed),
        ) as invoke_internal,
    ):
        await _check_category(
            category="education",
            system_prompt="prompt",
            model_name="model",
            user_info=AuthenticationResult(
                token="token", user_id="user", department="department"
            ),
        )

    to_thread.assert_awaited_once_with(read_prompt_file_with_metadata, "education")
    assert (
        invoke_internal.await_args.kwargs["langfuse_prompt"] is prompt.langfuse_prompt
    )
