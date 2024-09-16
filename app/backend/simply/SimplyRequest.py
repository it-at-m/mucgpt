from typing import List, Optional

from pydantic import BaseModel

from core.types.ChatRequest import ChatTurn


class SimplyRequest(BaseModel):
    topic: str
    language: str
    history: List[ChatTurn] = []
    temperature: Optional[float] = 0.5
    max_output_tokens: Optional[int] = 4096
    system_message: Optional[str] = None
    model: Optional[str] = "gpt-4o-mini"