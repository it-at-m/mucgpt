from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for core service database models."""


class Chat(Base):
    """Ownership and metadata for a LangGraph conversation."""

    __tablename__ = "chats"

    conversation_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    assistant_id: Mapped[str | None] = mapped_column(String, nullable=True)
    chat_title: Mapped[str] = mapped_column(
        String, nullable=False, server_default="New Chat"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CanvasDocument(Base):
    """Canvas document per conversation: markdown content plus client-owned
    revision rings."""

    __tablename__ = "canvas_documents"

    conversation_id: Mapped[str] = mapped_column(String, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # JSONB on Postgres; the JSON variant keeps create_all runnable under SQLite in tests.
    revisions: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
