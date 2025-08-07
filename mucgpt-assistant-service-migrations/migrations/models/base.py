"""
Minimal model definitions needed for migrations.
This avoids importing from the main application code.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.types import JSON

Base = declarative_base()

# Association table for many-to-many relationship between assistants and owners
assistant_owners = Table(
    "assistant_owners",
    Base.metadata,
    Column(
        "assistant_id",
        String(36),
        ForeignKey("assistants.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "lhmobjektID",
        String(255),
        ForeignKey("owners.lhmobjektID", ondelete="CASCADE"),
        primary_key=True,
    ),
    UniqueConstraint("assistant_id", "lhmobjektID", name="uq_assistant_owner"),
)


class AssistantTool(Base):
    """Tool associated with an assistant version."""

    __tablename__ = "assistant_tools"

    assistant_version_id = Column(
        Integer,
        ForeignKey("assistant_versions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tool_id = Column(String(255), primary_key=True)
    config = Column(JSON, nullable=True)


class AssistantVersion(Base):
    """Version of an assistant with configuration."""

    __tablename__ = "assistant_versions"

    id = Column(Integer, primary_key=True)
    assistant_id = Column(
        String(36), ForeignKey("assistants.id", ondelete="CASCADE"), nullable=False
    )
    version = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    name = Column(String(255), nullable=False)
    description = Column(Text)
    system_prompt = Column(Text, nullable=False)
    temperature = Column(Float, default=0.7)
    max_output_tokens = Column(Integer, default=1000)
    examples = Column(JSON, nullable=True)
    quick_prompts = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("assistant_id", "version", name="uq_assistant_version"),
    )


class Assistant(Base):
    """AI Assistant definition."""

    __tablename__ = "assistants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hierarchical_access = Column(JSON, default=list)
    is_visible = Column(Boolean, default=True, nullable=False)


class Owner(Base):
    """Owner of assistants."""

    __tablename__ = "owners"

    lhmobjektID = Column(String(255), primary_key=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    assistant_id = Column(
        String(36), ForeignKey("assistants.id", ondelete="CASCADE"), nullable=False
    )
    lhmobjektID = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
