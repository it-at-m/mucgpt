"""Request/response models for the chat import."""

from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, Field, field_validator

from api.api_models import ConversationRenameRequest

IMPORT_MAX_TURNS: Final = 1000
IMPORT_MAX_TEXT_CHARS: Final = 200_000
IMPORT_MAX_TITLE_CHARS: Final = 200


class ImportedTurn(BaseModel):
    """One finished browser turn (question + answer)."""

    user: str = Field(min_length=1, max_length=IMPORT_MAX_TEXT_CHARS)
    assistant: str = Field(min_length=1, max_length=IMPORT_MAX_TEXT_CHARS)

    @field_validator("user", "assistant", mode="after")
    @staticmethod
    def reject_blank(value: str) -> str:
        # failed turns are dropped by the client, never store empty messages
        if not value.strip():
            raise ValueError("must not be blank")
        return value


class ConversationImportRequest(BaseModel):
    """Browser-only chat that gets uploaded once to the backend.

    No system prompt: it is applied per request, never stored in the checkpoint.
    """

    conversation_id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=IMPORT_MAX_TITLE_CHARS)
    assistant_id: str | None = Field(default=None, min_length=1)
    # keeps the history order the user is used to
    last_edited: datetime | None = None
    turns: list[ImportedTurn] = Field(min_length=1, max_length=IMPORT_MAX_TURNS)

    # same single-line title as a manual rename
    _normalize_title = field_validator("title", mode="before")(
        ConversationRenameRequest.normalize_title
    )


class ConversationImportResult(BaseModel):
    """skipped = chat already had a checkpoint, nothing written."""

    status: Literal["imported", "skipped"]
