from typing import List

from pydantic import BaseModel


class Bot(BaseModel):
    title: str
    description: str
    system_message: str
    publish: bool
    id: int
    temperature: float
    max_output_tokens: int

class CommunityBotsResponse(BaseModel):
    bots: List[Bot]

