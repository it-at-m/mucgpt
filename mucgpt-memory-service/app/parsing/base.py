from abc import ABC, abstractmethod

from fastapi import UploadFile


class ParserBackend(ABC):
    """Abstract base class for file parsing backends."""

    @abstractmethod
    async def parse(self, file: UploadFile) -> dict:
        """Parse the uploaded file and return the extracted content.

        Args:
            file: The uploaded file to parse.

        Returns:
            A dict with the extracted content as returned by the backend.
        """
