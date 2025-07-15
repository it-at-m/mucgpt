from fastapi import APIRouter, Depends

from config.settings import ConfigResponse, ModelsDTO, get_settings
from core.auth import authenticate_user
from init_app import init_departments

router = APIRouter()
settings = get_settings()
departments = init_departments()


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
async def getConfig(user_info=Depends(authenticate_user)) -> ConfigResponse:
    response = ConfigResponse(
        frontend=settings.frontend,
        version=settings.version,
        commit=settings.commit,
    )

    models = settings.backend.models
    for model in models:
        dto = ModelsDTO(
            llm_name=model.llm_name,
            max_output_tokens=model.max_output_tokens,
            max_input_tokens=model.max_input_tokens,
            description=model.description,
        )
        response.models.append(dto)
    return response


@router.get("/departements")
async def getDepartements(user_info=Depends(authenticate_user)):
    return departments


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
