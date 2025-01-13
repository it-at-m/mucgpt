from typing import Optional

from pydantic import BaseModel

from core.types.CommunityBotsResponse import Bot


class GenerateTagsRequest(BaseModel):
    bot: Bot
    model: Optional[str] = "gpt-4o-mini"
    max_output_tokens: Optional[int] = 4096