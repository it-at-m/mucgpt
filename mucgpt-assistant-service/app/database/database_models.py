from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, TypedDict

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from api.api_models import AdminTag

from .path_matcher import _get_directory_index, path_matches_department


def utcnow() -> datetime:
    """Return the current UTC time as a naive datetime.

    Replaces the deprecated ``datetime.utcnow()`` while preserving the
    naive-UTC semantics of the existing columns.
    """
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


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
        "user_id",
        String(255),
        ForeignKey("owners.user_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    UniqueConstraint("assistant_id", "user_id", name="uq_assistant_owner"),
)


class AssistantTool(Base):
    __tablename__ = "assistant_tools"
    assistant_version_id: Mapped[int] = mapped_column(
        ForeignKey("assistant_versions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tool_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    assistant_version: Mapped[AssistantVersion] = relationship(
        "AssistantVersion", back_populates="tool_associations"
    )

    def __repr__(self):
        return f"<AssistantTool(assistant_version_id={self.assistant_version_id}, tool_id='{self.tool_id}')>"


class AssistantVersion(Base):
    __tablename__ = "assistant_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assistant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("assistants.id", ondelete="CASCADE")
    )
    version: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=True)

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text)
    creativity: Mapped[str] = mapped_column(
        String(10), default="medium", nullable=True
    )
    default_model: Mapped[str | None] = mapped_column(String(255))
    examples: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    quick_prompts: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    compliance_check_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    compliance_confirmation: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    state: Mapped[str] = mapped_column(
        String(32), default="active", server_default="active"
    )
    state_changed_by: Mapped[str | None] = mapped_column(String(255))
    state_change_reason: Mapped[str | None] = mapped_column(Text)

    assistant: Mapped[Assistant] = relationship(
        "Assistant", back_populates="versions"
    )
    tool_associations: Mapped[list[AssistantTool]] = relationship(
        "AssistantTool",
        back_populates="assistant_version",
        cascade="all, delete-orphan",
    )

    def tools(self) -> list[ToolAssociationDict]:
        """Return a list of tool configurations for the assistant version."""
        return [
            {"id": assoc.tool_id, "config": assoc.config}
            for assoc in self.tool_associations
        ]

    def to_dict(self) -> dict[str, Any]:
        """Convert AssistantVersion instance to a dictionary for test compatibility."""
        return {
            "name": self.name,
            "description": self.description,
            "system_prompt": self.system_prompt,
            "creativity": self.creativity,
            "default_model": self.default_model,
            "examples": self.examples,
            "quick_prompts": self.quick_prompts,
            "tags": self.tags,
            "compliance_check_result": self.compliance_check_result,
            "compliance_confirmation": self.compliance_confirmation,
            "state": self.state,
            "state_changed_by": self.state_changed_by,
            "state_change_reason": self.state_change_reason,
        }

    __table_args__ = (
        UniqueConstraint("assistant_id", "version", name="uq_assistant_version"),
        CheckConstraint(
            "state IN ('active', 'inactive', 'pending_legal_review')",
            name="ck_assistant_version_state",
        ),
    )

    def __repr__(self):
        return f"<AssistantVersion(assistant_id={self.assistant_id}, version='{self.version}')>"


class AssistantAuditEvent(Base):
    """Immutable record of a change made to an assistant."""

    __tablename__ = "assistant_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    assistant_id: Mapped[str] = mapped_column(String(36), index=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, index=True
    )
    actor_user_id: Mapped[str] = mapped_column(String(255))
    actor_name: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(64))
    before: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text)
    assistant_version: Mapped[int | None] = mapped_column()

    __table_args__ = (
        # Stable ordering for events created in the same microsecond.
        UniqueConstraint("occurred_at", "id", name="uq_assistant_audit_order"),
    )


class Assistant(Base):
    __tablename__ = "assistants"  # Use UUID version 4 (random) as the primary key
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=True
    )
    hierarchical_access: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    # Whether this assistant is publicly listed
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    admin_tags: Mapped[list[AdminTag]] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    subscriptions_count: Mapped[int] = mapped_column(
        default=0, server_default="0"
    )

    versions: Mapped[list[AssistantVersion]] = relationship(
        "AssistantVersion",
        back_populates="assistant",
        cascade="all, delete-orphan",
        order_by="desc(AssistantVersion.version)",
    )

    owners: Mapped[list[Owner]] = relationship(
        "Owner", secondary=assistant_owners, back_populates="assistants"
    )

    def is_owner(self, user_id: str) -> bool:
        """Check if the given user_id is an owner of this assistant."""
        return any(owner.user_id == user_id for owner in self.owners)

    async def is_allowed_for_user(
        self,
        department: str,
        directory_index=None,
    ) -> bool:
        """Check if a user with a given department is allowed to use this assistant.

        Uses the LDAP-backed directory tree to validate whether the assistant's
        access path is an ancestor of the user's department. Falls back to the
        legacy string matcher if the tree cannot be resolved.
        """

        if not self.hierarchical_access:
            return True

        if directory_index is None:
            directory_index = await _get_directory_index()

        for access_path in self.hierarchical_access:
            if access_path and await path_matches_department(
                access_path,
                department,
                directory_index=directory_index,
            ):
                return True

        return False

    @property
    def latest_version(self) -> AssistantVersion | None:
        return self.versions[0] if self.versions else None

    def __repr__(self):
        return f"<Assistant(id='{self.id}')>"


class Owner(Base):
    __tablename__ = "owners"

    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(255))
    given_name: Mapped[str | None] = mapped_column(String(255))
    surname: Mapped[str | None] = mapped_column(String(255))
    mail: Mapped[str | None] = mapped_column(String(255))
    organizational_unit: Mapped[str | None] = mapped_column(String(255))
    details_updated_at: Mapped[datetime | None] = mapped_column()

    assistants: Mapped[list[Assistant]] = relationship(
        "Assistant", secondary=assistant_owners, back_populates="owners"
    )

    def __repr__(self):
        return f"<Owner(user_id='{self.user_id}')>"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assistant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("assistants.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=True)

    assistant: Mapped[Assistant] = relationship("Assistant")

    __table_args__ = (
        UniqueConstraint("assistant_id", "user_id", name="uq_subscription"),
    )

    def __repr__(self):
        return f"<Subscription(assistant_id='{self.assistant_id}', user_id='{self.user_id}')>"


# Type definitions for the JSON fields in the database models


class ExampleDict(TypedDict, total=False):
    """Example for assistant training."""

    user_message: str
    assistant_response: str
    id: str
    title: str | None
    metadata: dict[str, Any] | None


class QuickPromptDict(TypedDict, total=False):
    """Quick prompt template for assistant."""

    id: str
    title: str
    prompt: str
    description: str | None
    category: str | None
    icon: str | None


class ToolConfigDict(TypedDict, total=False):
    """Configuration for a tool associated with an assistant version."""

    parameters: dict[str, Any]
    options: dict[str, Any]
    enabled: bool


class ToolAssociationDict(TypedDict):
    """Represents a tool associated with an assistant version."""

    id: str
    config: dict[str, Any] | None


# Type aliases for better readability in function signatures
Example = ExampleDict
QuickPrompt = QuickPromptDict
ToolAssociation = ToolAssociationDict
ToolDict = ToolAssociationDict
