import asyncio
from typing import Literal

from langfuse import observe
from pydantic import BaseModel, Field

from api.api_models import (
    COMPLIANCE_STATUS_ERROR,
    COMPLIANCE_STATUS_HIGH_RISK_DETECTED,
    COMPLIANCE_STATUS_PASSED,
    ChatCompletionMessage,
    ComplianceCategoryId,
    ComplianceCategoryResult,
    ComplianceCheckResponse,
    ComplianceStatus,
)
from config.settings import ComplianceConfig
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    invoke_internal_structured_generation,
    read_prompt_file,
)
from core.logtools import getLogger

logger = getLogger()

ComplianceVerdict = Literal["passed", "high_risk_detected"]


class _ComplianceVerdictResponse(BaseModel):
    verdict: ComplianceVerdict
    reasoning: str | None = Field(None, max_length=1000)


_COMPLIANCE_CATEGORIES: tuple[ComplianceCategoryId, ...] = (
    "migration_asylum_border",
    "public_services_access",
    "hr_employment",
    "education",
)


@observe(
    name="assistant-compliance-category-check",
    capture_input=False,
    capture_output=False,
)
async def _check_category(
    *,
    category: ComplianceCategoryId,
    prompt_folder: str,
    system_prompt: str,
    model_name: str,
    user_info: AuthenticationResult,
) -> ComplianceCategoryResult:
    system_instruction = read_prompt_file(category, prompt_folder)
    parsed = await invoke_internal_structured_generation(
        model_name=model_name,
        temperature=0.0,
        messages=[
            ChatCompletionMessage(role="system", content=system_instruction),
            ChatCompletionMessage(
                role="user",
                content=f"<assistant_system_prompt>\n{system_prompt}\n</assistant_system_prompt>",
            ),
        ],
        user_info=user_info,
        trace_tags=["assistant-compliance", category],
        run_name=f"assistant-compliance-{category}",
        schema=_ComplianceVerdictResponse,
    )

    return ComplianceCategoryResult(
        category=category,
        status=parsed.verdict,
        reasoning=(
            parsed.reasoning
            if parsed.verdict == COMPLIANCE_STATUS_HIGH_RISK_DETECTED
            else None
        ),
    )


async def evaluate_compliance(
    *,
    system_prompt: str,
    model_name: str,
    user_info: AuthenticationResult,
    config: ComplianceConfig,
) -> ComplianceCheckResponse:
    """Evaluate a system prompt independently against every compliance category."""

    try:
        results = await asyncio.gather(
            *(
                _check_category(
                    category=category,
                    prompt_folder=config.PROMPT_FOLDER,
                    system_prompt=system_prompt,
                    model_name=model_name,
                    user_info=user_info,
                )
                for category in _COMPLIANCE_CATEGORIES
            )
        )
    except Exception as exc:
        logger.exception("Assistant compliance check failed: %s", type(exc).__name__)
        return ComplianceCheckResponse(
            overall_status=COMPLIANCE_STATUS_ERROR,
            results=[],
        )

    overall_status: ComplianceStatus = (
        COMPLIANCE_STATUS_HIGH_RISK_DETECTED
        if any(
            result.status == COMPLIANCE_STATUS_HIGH_RISK_DETECTED for result in results
        )
        else COMPLIANCE_STATUS_PASSED
    )
    return ComplianceCheckResponse(
        overall_status=overall_status,
        results=results,
    )
