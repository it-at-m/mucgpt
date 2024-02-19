from typing import TypedDict, Literal
class Chunk(TypedDict):
    type: Literal['E', 'C', 'I']
    message: str 
    order: int


class ChunkInfo(TypedDict):
    requesttokens: int
    streamedtokens: int
