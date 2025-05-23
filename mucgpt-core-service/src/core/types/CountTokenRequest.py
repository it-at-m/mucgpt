from pydantic import BaseModel


class CountTokenRequest(BaseModel):
    text: str
    model: str
