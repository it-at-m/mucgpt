from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING
from xml.sax.saxutils import escape

from langchain_core.messages import SystemMessage

if TYPE_CHECKING:
    from core.document_service import SelectedDocument


def build_document_context(
    documents: Sequence[SelectedDocument], max_preview_chars: int, instructions: str
) -> str:
    """Render only server-authorized metadata; never fetch document bodies."""
    if not documents:
        return ""

    blocks = []
    for document in documents:
        blocks.append(
            "\n".join(
                [
                    "  <document>",
                    f"    <filename>{escape(document.filename[:255])}</filename>",
                    f"    <path>{escape(document.path)}</path>",
                    f"    <text-length>{document.text_length}</text-length>",
                    f"    <initial-excerpt>{escape(document.preview[:max_preview_chars])}</initial-excerpt>",
                    "  </document>",
                ]
            )
        )
    return (
        f"{instructions.strip()}\n\n"
        "<attached-documents>\n" + "\n".join(blocks) + "\n</attached-documents>"
    )


def add_document_context(
    system_message: SystemMessage | None, document_context: str
) -> SystemMessage | None:
    """Append per-turn context without mutating the prompt or checkpoint history."""
    if not document_context:
        return system_message
    if system_message is None:
        return SystemMessage(content=document_context)
    content = system_message.content
    content = (
        f"{content}\n\n{document_context}"
        if isinstance(content, str)
        else [*content, {"type": "text", "text": document_context}]
    )
    # Copy so reused prompts don't accumulate document context across model calls.
    return system_message.model_copy(update={"content": content})
