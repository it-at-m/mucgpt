from typing import List

from pydantic import BaseModel


class Bot(BaseModel):
    title: str
    description: str
    system_message: str
    publish: bool
    id: str
    temperature: float
    max_output_tokens: int
    version: float
    owner: str
    tags: List[str]

class CommunityBotsResponse(BaseModel):
    bots: List[List[Bot]]

