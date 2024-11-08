from typing import Optional

from pydantic import BaseModel


class CreateBotRequest(BaseModel):
    input: str
    model: Optional[str] = "gpt-4o-mini"
    max_output_tokens: Optional[int] = 4096