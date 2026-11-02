from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from api.api_models import DocumentMetadata
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.document_service import (
    DocumentIngestionService,
    DocumentProcessingDisabledError,
    DocumentSizeExceededError,
    EmptyDocumentExtractionError,
    InvalidDocumentTextError,
    InvalidDocumentUploadError,
    SelectedDocument,
)
from core.logtools import getLogger
from database.document_repo import DocumentQuotaExceededError

logger = getLogger()
router = APIRouter(prefix="/v1/documents", tags=["Documents"])


@router.post(
    "",
    status_code=201,
    response_model=DocumentMetadata,
    summary="Upload a document to the authenticated user's library",
    description=(
        "Extracts and stores document text, returning ready metadata and a bounded "
        "initial excerpt. Original files are not retained. All processing, ready, "
        "and deleting documents count toward the ten-document limit."
    ),
    responses={
        400: {"description": "Invalid upload or parser rejected the document"},
        409: {"description": "Document library limit of ten reached"},
        413: {"description": "Upload or extracted text exceeds its byte limit"},
        415: {"description": "Parser does not support the document format"},
        422: {"description": "Missing file, invalid extraction, or no usable text"},
        500: {"description": "Document storage or ingestion failed"},
        502: {"description": "Parser service returned an error"},
        503: {"description": "Document processing is not enabled"},
        504: {"description": "Parser service timed out"},
    },
)
async def upload_document(
    file: Annotated[UploadFile, File(description="Document to extract and store")],
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> SelectedDocument:
    # FastAPI owns the multipart upload's lifetime. Ingestion bounds actual file
    # reads before parsing; these limits do not bound HTTP multipart spooling.
    try:
        return await DocumentIngestionService().ingest_document(user_info, file)
    except InvalidDocumentUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DocumentQuotaExceededError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DocumentSizeExceededError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except EmptyDocumentExtractionError as exc:
        raise HTTPException(
            status_code=422, detail="Document extraction returned no usable text."
        ) from exc
    except InvalidDocumentTextError as exc:
        raise HTTPException(
            status_code=422, detail="Document extraction returned invalid text."
        ) from exc
    except DocumentProcessingDisabledError as exc:
        raise HTTPException(
            status_code=503, detail="Document processing is not enabled."
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504, detail="Parser service timed out."
        ) from exc
    except httpx.HTTPStatusError as exc:
        # Only document-rejection statuses are client errors. Upstream auth,
        # routing, capacity, and server failures are parser integration errors.
        rejection_details = {
            400: "Parser rejected the document.",
            413: "Document exceeds the parser service byte limit.",
            415: "Parser does not support the document format.",
            422: "Parser could not extract the document.",
        }
        status_code = exc.response.status_code
        if status_code in rejection_details:
            raise HTTPException(
                status_code=status_code, detail=rejection_details[status_code]
            ) from exc
        logger.exception("Document parser service returned an HTTP error")
        raise HTTPException(
            status_code=502, detail="Parser service returned an error."
        ) from exc
    except httpx.RequestError as exc:
        logger.exception("Document parser service request failed")
        raise HTTPException(
            status_code=502, detail="Parser service returned an error."
        ) from exc
    except Exception as exc:
        # Compensation belongs to ingestion. Do not expose internal exceptions,
        # parser payloads, stored text, namespaces, or credentials to the caller.
        logger.exception("Document ingestion failed")
        raise HTTPException(
            status_code=500, detail="Document could not be stored."
        ) from exc
