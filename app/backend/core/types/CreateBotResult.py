from pydantic import BaseModel


class CreateBotResult(BaseModel):
    title: str
    description: str
    system_prompt: str