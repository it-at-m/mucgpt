import asyncio
import hashlib
from typing import Literal

from fastapi import APIRouter, Depends
from langfuse import observe
from pydantic import BaseModel, Field

from api.api_models import (
    COMPLIANCE_STATUS_ERROR,
    COMPLIANCE_STATUS_HIGH_RISK_DETECTED,
    COMPLIANCE_STATUS_PASSED,
    ChatCompletionMessage,
    ComplianceCategoryId,
    ComplianceCategoryResult,
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    ComplianceStatus,
)
from config.settings import InternalTaskModelStrength, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    COMPLIANCE_PROMPTS_DIR,
    get_internal_task_model,
    invoke_internal_structured_generation,
    read_prompt_file,
)
from core.logtools import getLogger

logger = getLogger()
router = APIRouter(prefix="/v1")

ComplianceVerdict = Literal["passed", "high_risk_detected"]


class _ComplianceVerdictResponse(BaseModel):
    verdict: ComplianceVerdict
    reasoning: str | None = Field(None, max_length=1000)


_CATEGORY_PROMPTS: tuple[tuple[ComplianceCategoryId, str], ...] = (
    ("migration_asylum_border", "prompt_for_compliance_migration_asylum_border.md"),
    ("public_services_access", "prompt_for_compliance_public_services_access.md"),
    ("hr_employment", "prompt_for_compliance_hr_employment.md"),
    ("education", "prompt_for_compliance_education.md"),
)


@observe(
    name="assistant-compliance-category-check",
    capture_input=False,
    capture_output=False,
)
async def _check_category(
    *,
    category: ComplianceCategoryId,
    prompt_template_filename: str,
    system_prompt: str,
    model_name: str,
    user_info: AuthenticationResult,
) -> ComplianceCategoryResult:
    system_instruction = read_prompt_file(
        COMPLIANCE_PROMPTS_DIR, prompt_template_filename
    )
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


@router.post(
    "/compliance/check",
    summary="Screen an assistant system prompt for EU AI Act high-risk use cases",
    response_model=ComplianceCheckResponse,
)
@observe(name="assistant-compliance-check", capture_input=False, capture_output=False)
async def check_assistant_compliance(
    request: ComplianceCheckRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> ComplianceCheckResponse:
    """Evaluate the system prompt independently against each relevant category."""

    prompt_hash = hashlib.sha256(request.system_prompt.encode("utf-8")).hexdigest()

    try:
        model_name = get_internal_task_model(
            get_settings(), InternalTaskModelStrength.STRONG
        )
        results = await asyncio.gather(
            *(
                _check_category(
                    category=category,
                    prompt_template_filename=prompt_template_filename,
                    system_prompt=request.system_prompt,
                    model_name=model_name,
                    user_info=user_info,
                )
                for category, prompt_template_filename in _CATEGORY_PROMPTS
            )
        )
    except Exception as exc:
        logger.exception("Assistant compliance check failed: %s", type(exc).__name__)
        return ComplianceCheckResponse(
            overall_status=COMPLIANCE_STATUS_ERROR,
            results=[],
            prompt_hash=prompt_hash,
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
        prompt_hash=prompt_hash,
    )
