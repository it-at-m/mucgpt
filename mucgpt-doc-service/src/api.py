import uuid
from typing import Dict

from fastapi import FastAPI, UploadFile, HTTPException

from core.logtools import getLogger
from docling import Docling

logger = getLogger()
api = FastAPI()
docling = Docling()

# FIXME in-memory "database" to store file content mapped to a UUID
file_storage: Dict[str, str] = {}

@api.post("/docs/")
async def upload_file(file: UploadFile) -> str:
    """
    Uploads a file and returns a unique UUID for retrieval.
    """
    # generate file id
    file_id = str(uuid.uuid4())

    # process file
    logger.info(f"Processing file {file_id} with {file.size} bytes")
    processed_content = await docling.process_doc(file)
    logger.info(f"Processing of file {file_id} finished")

    # store the file content using the UUID as key
    file_storage[file_id] = processed_content

    # return file id
    return file_id

@api.get("/docs/{file_id}")
async def get_file(file_id: str) -> str:
    """
    Retrieves the content of a file using its UUID.
    Returns the content as a string (assuming text files for simplicity).
    """
    logger.info(f"Getting file {file_id}")
    # check if the UUID exists in storage
    if file_id not in file_storage:
        raise HTTPException(status_code=404, detail=f"File with ID '{file_id}' not found")

    # retrieve the file content (bytes)
    content_string = file_storage[file_id]
    
    # return the content string
    return content_string
