from pydantic import BaseModel


class StatisticsResponse(BaseModel):
    sum: float
    avg: float
