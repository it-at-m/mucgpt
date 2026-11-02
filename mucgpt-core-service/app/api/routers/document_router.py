from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from api.api_models import DocumentLibraryEntry, DocumentMetadata
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.document_service import (
    DocumentIngestionService,
    DocumentLibraryService,
    DocumentProcessingDisabledError,
    DocumentProcessingError,
    DocumentSizeExceededError,
    DocumentUnavailableError,
    EmptyDocumentExtractionError,
    InvalidDocumentTextError,
    InvalidDocumentUploadError,
    LibraryDocument,
    SelectedDocument,
)
from core.logtools import getLogger
from database.document_repo import DocumentQuotaExceededError

logger = getLogger()
router = APIRouter(prefix="/v1/documents", tags=["Documents"])


@router.get(
    "",
    response_model=list[DocumentLibraryEntry],
    summary="List the authenticated user's document library",
    description=(
        "Returns metadata and initial excerpts without reading document bodies. "
        "Processing and deleting entries are included because they occupy quota slots; "
        "only ready documents can be attached to chats."
    ),
    responses={500: {"description": "Document library could not be loaded"}},
)
async def list_documents(
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> list[LibraryDocument]:
    try:
        return await DocumentLibraryService().list_documents(user_info)
    except Exception as exc:
        logger.exception("Document library listing failed")
        raise HTTPException(
            status_code=500, detail="Document library could not be loaded."
        ) from exc


@router.delete(
    "/{document_id}",
    status_code=204,
    summary="Delete an owned document from the library",
    description=(
        "Makes the document unavailable before deleting its extracted text. "
        "Its quota slot is released only after cleanup succeeds. Failed cleanup "
        "can be retried; actively processing uploads cannot be deleted."
    ),
    responses={
        404: {"description": "Document unavailable"},
        409: {"description": "Document busy or still processing"},
        500: {"description": "Document cleanup failed; deletion can be retried"},
    },
)
async def delete_document(
    document_id: UUID,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> None:
    try:
        await DocumentLibraryService().delete_document(user_info, str(document_id))
    except DocumentUnavailableError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Document library deletion failed")
        raise HTTPException(
            status_code=500, detail="Document could not be deleted. Retry deletion."
        ) from exc


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
