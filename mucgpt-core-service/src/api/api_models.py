from typing import List, Optional

from pydantic import BaseModel, Field


class BrainstormRequest(BaseModel):
    """Request model for the brainstorm endpoint."""

    topic: str = Field(..., description="The topic to brainstorm about.")
    language: str = Field(
        "Deutsch", description="The language of the brainstorm result."
    )
    model: str = Field("gpt-4o-mini", description="The model to use for brainstorming.")


class BrainstormResult(BaseModel):
    """Result model for the brainstorm endpoint."""

    answer: str = Field(..., description="The brainstormed answer.")


class ChatTurn(BaseModel):
    """A single turn in a chat, containing a user message and an optional bot response."""

    user: str = Field(..., description="The user's message.")
    bot: Optional[str] = Field(None, description="The bot's response.")


class ChatRequest(BaseModel):
    """Request model for the chat endpoint."""

    history: List[ChatTurn] = Field([], description="The chat history.")
    temperature: Optional[float] = Field(
        0.7, description="The temperature for the model."
    )
    max_output_tokens: Optional[int] = Field(
        4096, description="The maximum number of output tokens."
    )
    system_message: Optional[str] = Field(
        None, description="The system message for the model."
    )
    model: Optional[str] = Field(
        "gpt-4o-mini", description="The model to use for the chat."
    )


class ChatResult(BaseModel):
    """Result model for the chat endpoint."""

    content: str = Field(..., description="The content of the chat response.")


class CountResult(BaseModel):
    """Result model for a count operation."""

    count: int = Field(..., description="The result of the count operation.")


class CountTokenRequest(BaseModel):
    """Request model for counting tokens."""

    text: str = Field(..., description="The text to count tokens for.")
    model: str = Field(..., description="The model to use for token counting.")


class SummarizeResult(BaseModel):
    """Result model for the summarize endpoint."""

    answer: List[str] = Field(
        ..., description="The summarized text as a list of strings."
    )


class SumRequest(BaseModel):
    """Request model for the summarize endpoint."""

    text: str = Field("", description="The text to summarize.")
    detaillevel: Optional[str] = Field(
        "short",
        description="The desired level of detail for the summary (e.g., 'short', 'medium', 'long').",
    )
    language: Optional[str] = Field(
        "Deutsch", description="The language of the summary."
    )
    model: str = Field("gpt-4o-mini", description="The model to use for summarization.")


class SimplyRequest(BaseModel):
    """Request model for the 'simply' endpoint (simplify text)."""

    topic: str = Field(..., description="The text to simplify.")
    temperature: Optional[float] = Field(
        0, description="The temperature for the model."
    )
    model: Optional[str] = Field(
        "gpt-4o-mini", description="The model to use for simplification."
    )
