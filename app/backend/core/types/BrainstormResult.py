from pydantic import BaseModel


class BrainstormResult(BaseModel):
    answer: str