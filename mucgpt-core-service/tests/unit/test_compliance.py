from unittest.mock import AsyncMock, patch

import pytest

from api.api_models import ComplianceCategoryResult
from config.settings import ComplianceConfig
from core.auth_models import AuthenticationResult
from core.compliance import evaluate_compliance


@pytest.mark.unit
@pytest.mark.asyncio
async def test_compliance_uses_configured_folder_for_fixed_categories() -> None:
    check_category = AsyncMock(
        side_effect=lambda **kwargs: ComplianceCategoryResult(
            category=kwargs["category"], status="passed", reasoning=None
        )
    )

    with patch("core.compliance._check_category", check_category):
        result = await evaluate_compliance(
            system_prompt="prompt",
            model_name="model",
            user_info=AuthenticationResult(
                token="token", user_id="user", department="department"
            ),
            config=ComplianceConfig(PROMPT_FOLDER="annex-three"),
        )

    assert [item.category for item in result.results] == [
        "migration_asylum_border",
        "public_services_access",
        "hr_employment",
        "education",
    ]
    assert {
        call.kwargs["prompt_folder"] for call in check_category.await_args_list
    } == {"annex-three"}


@pytest.mark.unit
def test_compliance_prompt_folder_is_normalized() -> None:
    assert (
        ComplianceConfig(PROMPT_FOLDER="/annex-three/").PROMPT_FOLDER == "annex-three"
    )
