from typing import Optional

from pydantic import BaseModel


class SimplyRequest(BaseModel):
    topic: str
    temperature: Optional[float] = 0
    model: Optional[str] = "gpt-4o-mini"
    output_type: str = "plain"