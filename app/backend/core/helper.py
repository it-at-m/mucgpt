
import logging
from typing import AsyncGenerator

from core.types.Chunk import Chunk


async def format_as_ndjson(r: AsyncGenerator[Chunk, None]) -> AsyncGenerator[str, None]:
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
        logging.exception("Exception while generating response stream: %s", e)
        msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen." if "Rate limit" in str(e) else str(e)
        yield Chunk(type="E", message=msg).model_dump_json()