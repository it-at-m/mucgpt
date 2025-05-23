from pydantic import BaseModel


class ChatResult(BaseModel):
    content: str
