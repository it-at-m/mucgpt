import hashlib

from fastapi import APIRouter, Depends
from langfuse import observe

from api.api_models import (
    ComplianceCheckRequest,
    ComplianceCheckResponse,
)
from config.settings import InternalTaskModelStrength, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.compliance import evaluate_compliance
from core.llm_helpers import get_internal_task_model
from core.logtools import getLogger

logger = getLogger()
router = APIRouter(prefix="/v1")

_COMPLIANCE_CACHE_KEY_PREFIX = "mucgpt:assistant-compliance:v1:"


def _build_compliance_cache_key(prompt_hash: str) -> str:
    return f"{_COMPLIANCE_CACHE_KEY_PREFIX}{prompt_hash}"


async def _cache_compliance_result(result: ComplianceCheckResponse) -> None:
    settings = get_settings()
    if not settings.COMPLIANCE_CACHE_ENABLED:
        return
    if not result.prompt_hash:
        return
    try:
        await RedisCache.init_redis()
        await RedisCache.set_object(
            _build_compliance_cache_key(result.prompt_hash),
            result.model_dump(),
            ttl=settings.COMPLIANCE_CACHE_TTL_SECONDS,
        )
    except Exception:
        logger.warning(
            "Failed to cache compliance result for prompt hash %s",
            result.prompt_hash,
            exc_info=True,
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

    model_name = get_internal_task_model(
        get_settings(), InternalTaskModelStrength.STRONG
    )
    response = await evaluate_compliance(
        system_prompt=request.system_prompt,
        model_name=model_name,
        user_info=user_info,
    )
    response.prompt_hash = prompt_hash
    await _cache_compliance_result(response)
    return response
