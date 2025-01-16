
from pydantic import BaseModel


class GenerateTagsResponse(BaseModel):
    tag1: str
    tag2: str
    tag3: str