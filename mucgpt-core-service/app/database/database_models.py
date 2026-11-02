from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for core service database models."""


class Chat(Base):
    """Ownership and metadata for a LangGraph conversation."""

    __tablename__ = "chats"

    conversation_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assistant_id: Mapped[str | None] = mapped_column(String, nullable=True)
    document_ids: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
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


class Document(Base):
    """Owned catalog metadata; extracted bodies live in the filesystem store.

    Every row occupies one of ten slots, including processing and deleting rows.
    Capacity is released only by removing the row after storage cleanup.
    """

    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("user_id", "slot", name="uq_documents_user_slot"),
        CheckConstraint("slot >= 0 AND slot < 10", name="ck_documents_slot"),
        CheckConstraint(
            "status IN ('processing', 'ready', 'deleting')",
            name="ck_documents_status",
        ),
        CheckConstraint("original_size >= 0", name="ck_documents_original_size"),
        CheckConstraint(
            "status != 'ready' OR (text_length IS NOT NULL AND text_length > 0 "
            "AND preview IS NOT NULL AND preview_kind IS NOT NULL "
            "AND preview_kind = 'initial_excerpt')",
            name="ck_documents_ready_metadata",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    slot: Mapped[int] = mapped_column(Integer, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    original_size: Mapped[int] = mapped_column(Integer, nullable=False)
    text_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview: Mapped[str | None] = mapped_column(String, nullable=True)
    preview_kind: Mapped[str | None] = mapped_column(String, nullable=True)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
