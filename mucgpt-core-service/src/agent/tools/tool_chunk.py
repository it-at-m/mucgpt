from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class ToolStreamState(str, Enum):
    """Enumeration representing the state of a tool stream chunk.
    STARTED: The tool invocation has started. Content is for status update.
    UPDATE: The tool is providing an update. Content is the tool output. Should replace previous output.
    APPEND: The tool is appending additional content. Content is the new output. Should be added to previous output.
    ENDED: The tool invocation has ended. Content is for status update.
    ROLLBACK: The tool invocation has been rolled back. Content is for status update.
    """

    STARTED = "STARTED"
    UPDATE = "UPDATE"
    APPEND = "APPEND"
    ENDED = "ENDED"
    ROLLBACK = "ROLLBACK"


class ToolStreamChunk(BaseModel):
    state: ToolStreamState
    content: Any
    tool_name: Optional[str] = None
    metadata: Optional[dict] = None
