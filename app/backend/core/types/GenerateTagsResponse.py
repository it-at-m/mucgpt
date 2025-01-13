from typing import List

from pydantic import BaseModel


class GenerateTagsResponse(BaseModel):
    tags: List[str]