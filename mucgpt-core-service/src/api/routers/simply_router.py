from fastapi import APIRouter, Depends, HTTPException

from api.api_models import ChatResult, SimplyRequest
from core.auth import authenticate_user
from core.helper import llm_exception_handler
from core.logtools import getLogger
from init_app import simply_service

logger = getLogger()
router = APIRouter()


@router.post(
    "/simply",
    summary="Simplify a topic",
    description="This endpoint receives a topic and returns a simplified explanation.",
    response_model=ChatResult,
    responses={
        200: {"description": "Successful Response"},
        401: {"description": "Unauthorized"},
        500: {"description": "Internal Server Error"},
    },
)
async def simply(
    request: SimplyRequest, user_info=Depends(authenticate_user)
) -> ChatResult:
    try:
        r = simply_service.simply(
            message=request.topic,
            department=user_info.department,
            llm_name=request.model,
            temperature=request.temperature,
        )
        return r
    except Exception as e:
        logger.exception("Exception in /simply")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
