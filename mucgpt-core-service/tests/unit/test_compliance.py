from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from core.auth_models import AuthenticationResult
from core.compliance import _check_category


@pytest.mark.unit
@pytest.mark.asyncio
async def test_category_check_resolves_prompt_by_category_name() -> None:
    parsed = SimpleNamespace(verdict="passed", reasoning=None)

    with (
        patch(
            "core.compliance.read_prompt_file", return_value="instruction"
        ) as read_prompt,
        patch(
            "core.compliance.invoke_internal_structured_generation",
            AsyncMock(return_value=parsed),
        ),
    ):
        await _check_category(
            category="education",
            system_prompt="prompt",
            model_name="model",
            user_info=AuthenticationResult(
                token="token", user_id="user", department="department"
            ),
        )

    read_prompt.assert_called_once_with("education")
