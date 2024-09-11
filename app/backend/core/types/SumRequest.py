from typing import Optional

from pydantic import BaseModel


class SumRequest(BaseModel):
    text: str = ""
    detaillevel: Optional[str] = "short"
    language: Optional[str] = 4096
    model: str = "gpt-4o-mini"