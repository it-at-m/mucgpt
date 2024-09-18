from pydantic import BaseModel


class BrainstormRequest(BaseModel):
    topic:str
    language:str = "Deutsch"
    model:str = "gpt-4o-mini"