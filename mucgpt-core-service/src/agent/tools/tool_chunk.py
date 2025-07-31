from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class ToolStreamState(str, Enum):
    STARTED = "started"
    ENDED = "ended"
    UPDATE = "update"
    APPEND = "append"
    ROLLBACK = "rollback"


class ToolStreamChunk(BaseModel):
    state: ToolStreamState
    content: Any
    tool_name: Optional[str] = None
    metadata: Optional[dict] = None
