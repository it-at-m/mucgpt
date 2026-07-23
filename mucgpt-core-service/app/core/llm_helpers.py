import hashlib
import re
from collections.abc import Sequence
from typing import Any, Protocol

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage


class MessageLike(Protocol):
    role: str
    content: str


def to_langchain_messages(messages: Sequence[MessageLike]) -> list[BaseMessage]:
    """Convert API-style messages to LangChain message objects."""
    converted: list[BaseMessage] = []
    for message in messages:
        if message.role == "system":
            converted.append(SystemMessage(message.content))
        elif message.role == "user":
            converted.append(HumanMessage(message.content))
        else:
            converted.append(AIMessage(message.content))
    return converted


def hash_user_id(user_id: str | None) -> str | None:
    """Return a deterministic SHA-256 hash for user IDs used in tracing."""
    if not user_id:
        return None
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()


def extract_department_prefix(department: str | None) -> str | None:
    """Return leading alphabetic prefix of department (e.g., POR from POR/3)."""
    if not department:
        return None
    match = re.match(r"[A-Za-z]+", department)
    return match.group(0) if match else None


def extract_message_content(content: Any) -> str:
    """Normalize LLM output content to plain string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(str(part) for part in content if part is not None).strip()
    if content is None:
        return ""
    return str(content)
