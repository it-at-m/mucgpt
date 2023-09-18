from abc import ABC, abstractmethod
from typing import Dict, Any


class Approach(ABC):
    @abstractmethod
    async def run(self, q: str, overrides: 'Dict[str, Any]') -> 'Dict[str, Any]':
        ...
