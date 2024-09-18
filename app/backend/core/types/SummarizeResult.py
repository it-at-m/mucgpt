from typing import List

from openai import BaseModel


class SummarizeResult(BaseModel):
    answer: List[str]