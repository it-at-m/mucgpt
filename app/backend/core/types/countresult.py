from pydantic import BaseModel


class CountResult(BaseModel):
    count: int