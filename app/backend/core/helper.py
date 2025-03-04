from logging import Logger
from typing import AsyncGenerator

from core.types.Chunk import Chunk


async def format_as_ndjson(r: AsyncGenerator[Chunk, None], logger: Logger) -> AsyncGenerator[str, None]:
    """Converts stream of Chunks into Stream of serialized JSON Objects

    Args:
        r (AsyncGenerator[Chunk, None]): a generator, that returns chunks

    Returns:
        AsyncGenerator[str, None]: a genererator, that returns str

    Yields:
        Iterator[AsyncGenerator[str, None]]: a stringified chunk
    """
    try:
        async for event in r:
            yield event.model_dump_json() + "\n"
    except Exception as e:
        msg = llm_exception_handler(ex=e, logger=logger)
        yield Chunk(type="E", message=msg).model_dump_json()

def llm_exception_handler(ex: Exception, logger: Logger) -> str:
    """Handles exceptions thrown by the LLM

    Args:
        ex (Exception): the exception
        logger (Logger): the logger

    Returns:
        str: the error message
    """
    msg = ex.message
    try:
        if hasattr(ex, 'status_code') and hasattr(ex, 'code') and ex.status_code == 400 and ex.code == "content_filter":
            msg = "Es wurde ein Richtlinienverstoß festgestellt und der Chat wird hier beendet"
        elif hasattr(ex, 'status_code') and ex.status_code == 429:
            msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen."
        else:
            msg = f"Ein Fehler ist aufgetreten: {str(ex)}"
        logger.error("Chat error details: %s", vars(ex) if hasattr(ex, '__dict__') else str(ex))
    except Exception as nested_ex:
        msg = "Es ist ein unbekannter Fehler aufgetreten."
        logger.error("Error while handling chat exception: %s", nested_ex)
    return msg
