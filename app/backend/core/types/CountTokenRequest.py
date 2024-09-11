from pydantic import BaseModel


class CountTokensRequest(BaseModel):
    text: str
    model: str