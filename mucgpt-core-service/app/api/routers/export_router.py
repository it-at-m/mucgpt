from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from core.auth import authenticate_user
from core.logtools import getLogger
from export.converter import ExportRequest, convert_export

logger = getLogger()

router = APIRouter(prefix="/v1")


@router.post(
    "/export",
    summary="Export canvas content",
    description="Converts canvas content to PDF, DOCX or XLSX and returns it as a binary file download.",
    responses={
        200: {"description": "Converted file"},
        502: {"description": "Conversion failed"},
    },
)
def export_canvas(
    request: ExportRequest, user_info=Depends(authenticate_user)
) -> StreamingResponse:
    # sync endpoint: FastAPI runs it in the threadpool, converters must not block the event loop
    logger.info(f"Exporting canvas content as '{request.target}'")
    try:
        data, mimetype, filename = convert_export(request)
    except Exception as exc:
        logger.error(f"Export failed: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail="Conversion failed.")
    return StreamingResponse(
        BytesIO(data),
        media_type=mimetype,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
