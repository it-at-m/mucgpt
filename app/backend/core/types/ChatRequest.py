from typing import List, Optional

from pydantic import BaseModel


class ChatTurn(BaseModel):
    user: str
    bot: Optional[str] = None
    
class ChatRequest(BaseModel):
    history: List[ChatTurn] = []
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    system_message: Optional[str] = None
    model: Optional[str] = "gpt-4o-mini"