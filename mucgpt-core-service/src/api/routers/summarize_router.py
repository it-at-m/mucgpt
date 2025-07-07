import io

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic_core import from_json

from api.api_models import SummarizeResult, SumRequest
from config.settings import get_settings
from core.auth import authenticate_user
from core.logtools import getLogger
from init_app import initSummarizeService

logger = getLogger()
settings = get_settings()
summarize_service = initSummarizeService(settings.backend)
router = APIRouter()


@router.post(
    "/sum",
    summary="Summarize text or a file",
    description="This endpoint receives text or a file and returns a summary.",
    response_model=SummarizeResult,
    responses={
        200: {"description": "Successful Response"},
        401: {"description": "Unauthorized"},
        500: {"description": "Internal Server Error"},
    },
)
async def sum(
    body: str = Form(...), file: UploadFile = None, user_info=Depends(authenticate_user)
) -> SummarizeResult:
    """
    This endpoint receives text or a file and returns a summary.
    """
    sumRequest = SumRequest.model_validate(from_json(body))
    text = sumRequest.text if file is None else None
    if file is not None:
        file_content = io.BytesIO(await file.read())
    else:
        file_content = None
    try:
        splits = summarize_service.split(
            detaillevel=sumRequest.detaillevel, file=file_content, text=text
        )
        r = await summarize_service.summarize(
            splits=splits,
            department=user_info.department,
            language=sumRequest.language,
            llm_name=sumRequest.model,
        )
        return r
    except Exception as e:
        logger.exception("Exception in /sum")
        logger.exception(str(e))
        raise HTTPException(
            status_code=500, detail="Exception in summarize: something bad happened"
        )
