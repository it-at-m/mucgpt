from fastapi import APIRouter, Depends

from api.api_models import ConfigResponse, ModelsDTO
from config.settings import get_settings
from core.auth import authenticate_user

router = APIRouter()
settings = get_settings()


@router.get(
    "/config",
    summary="Get application configuration",
    description="This endpoint returns the configuration of the application.",
    response_model=ConfigResponse,
    responses={
        200: {"description": "Successful Response"},
        401: {"description": "Unauthorized"},
    },
)
async def get_config(user_info=Depends(authenticate_user)) -> ConfigResponse:
    response = ConfigResponse(
        env_name=settings.ENV_NAME,
        alternative_logo=settings.ALTERNATIVE_LOGO,
        core_version=settings.VERSION,
        frontend_version=settings.FRONTEND_VERSION,
        assistant_version=settings.ASSISTANT_VERSION,
    )

    models = settings.MODELS
    for model in models:
        dto = ModelsDTO(
            llm_name=model.llm_name,
            max_input_tokens=model.max_input_tokens,
            description=model.description,
            input_cost_per_token=model.input_cost_per_token,
            output_cost_per_token=model.output_cost_per_token,
            supports_function_calling=model.supports_function_calling,
            supports_reasoning=model.supports_reasoning,
            supports_vision=model.supports_vision,
            litellm_provider=model.litellm_provider,
            inference_location=model.inference_location,
            knowledge_cut_off=model.knowledge_cut_off,
        )
        response.models.append(dto)
    return response


@router.get(
    "/health",
    summary="Health check",
    description="This endpoint can be used to check the health of the application.",
    responses={
        200: {"description": "Successful Response"},
    },
)
def health_check() -> str:
    return "OK"
