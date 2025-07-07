from fastapi import APIRouter, Depends, HTTPException

from api.api_models import BrainstormRequest, BrainstormResult
from api.exception import llm_exception_handler
from config.settings import get_settings
from core.auth import authenticate_user
from core.logtools import getLogger
from init_app import initBrainstormService

logger = getLogger()
settings = get_settings()
brainstorm_service = initBrainstormService(settings.backend)
router = APIRouter()


@router.post(
    "/brainstorm",
    summary="Brainstorm a topic",
    description="This endpoint receives a topic and returns a brainstormed answer.",
    response_model=BrainstormResult,
    responses={
        200: {"description": "Successful Response"},
        500: {"description": "Internal Server Error"},
    },
)
async def brainstorm(
    request: BrainstormRequest, user_info=Depends(authenticate_user)
) -> BrainstormResult:
    """
    This endpoint receives a topic and returns a brainstormed answer.
    """
    try:
        r = await brainstorm_service.brainstorm(
            topic=request.topic,
            language=request.language,
            department=user_info.department,
            llm_name=request.model,
        )
        return r
    except Exception as e:
        logger.exception("Exception in /brainstorm")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
