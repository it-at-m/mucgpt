from pydantic import BaseModel
from typing import Literal

class Chunk(BaseModel):
    """Represents a chunk during streaming. Has 3 modes:
    E: Error, message contains the error message.
    C: Content, message contains the streamed content.
    I: Info, contains a ChunkInfo inside the message (how many tokens has the whole stream consumed).
    Usually is the last message of the stream.
    """
    type: Literal['E', 'C', 'I']
    message: str
    order: int

class ChunkInfo(BaseModel):
    """Totally consumed tokens during all messages of the stream.
    """
    requesttokens: int
    streamedtokens: int