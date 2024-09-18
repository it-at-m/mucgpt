from pydantic import BaseModel


class BrainstormError(BaseModel):
    error:str