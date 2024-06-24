
from typing import AsyncGenerator
import json
import logging
from core.types.Chunk import Chunk

async def format_as_ndjson(r: AsyncGenerator[Chunk, None]) -> AsyncGenerator[str, None]:
    try:
        async for event in r:
            yield json.dumps(event, ensure_ascii=False) + "\n"
    except Exception as e:
        logging.exception("Exception while generating response stream: %s", e)
        msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen." if "Rate limit" in str(e) else str(e)
        yield json.dumps(Chunk(type="E", message=msg))