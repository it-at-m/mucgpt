from typing import List

from pydantic import BaseModel

from core.types.CommunityBotsResponse import Bot


class CommunityBotAllVersionsResponse(BaseModel):
    bots: List[Bot]

