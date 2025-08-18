import uuid
from datetime import datetime
from typing import Optional, TypeVar

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
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import JSON

Base = declarative_base()
ModelType = TypeVar("ModelType", bound=Base)  # type: ignore # Define a TypeVar for the model

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
    __tablename__ = "assistant_tools"
    assistant_version_id = Column(
        Integer,
        ForeignKey("assistant_versions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tool_id = Column(String(255), primary_key=True)
    config = Column(JSON, nullable=True)

    assistant_version = relationship(
        "AssistantVersion", back_populates="tool_associations"
    )

    def __repr__(self):
        return f"<AssistantTool(assistant_version_id={self.assistant_version_id}, tool_id='{self.tool_id}')>"


class AssistantVersion(Base):
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

    assistant = relationship("Assistant", back_populates="versions")
    tool_associations = relationship(
        "AssistantTool",
        back_populates="assistant_version",
        cascade="all, delete-orphan",
    )

    def tools(self):
        """Return a list of tool configurations for the assistant version."""
        return [
            {"id": assoc.tool_id, "config": assoc.config}
            for assoc in self.tool_associations
        ]

    def to_dict(self):
        """Convert AssistantVersion instance to a dictionary for test compatibility."""
        return {
            "name": self.name,
            "description": self.description,
            "system_prompt": self.system_prompt,
            "temperature": self.temperature,
            "max_output_tokens": self.max_output_tokens,
            "examples": self.examples,
            "quick_prompts": self.quick_prompts,
            "tags": self.tags,
        }

    __table_args__ = (
        UniqueConstraint("assistant_id", "version", name="uq_assistant_version"),
    )

    def __repr__(self):
        return f"<AssistantVersion(assistant_id={self.assistant_id}, version='{self.version}')>"


class Assistant(Base):
    __tablename__ = "assistants"  # Use UUID version 4 (random) as the primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hierarchical_access = Column(JSON, default=list)
    is_visible = Column(
        Boolean, default=True, nullable=False
    )  # Whether this assistant is publicly listed
    subscriptions_count = Column(Integer, nullable=False, default=0, server_default="0")

    versions = relationship(
        "AssistantVersion",
        back_populates="assistant",
        cascade="all, delete-orphan",
        order_by="desc(AssistantVersion.version)",
    )

    owners = relationship(
        "Owner", secondary=assistant_owners, back_populates="assistants"
    )

    def is_owner(self, lhmobjektID: str) -> bool:
        """Check if the given lhmobjektID is an owner of this assistant."""
        return any(owner.lhmobjektID == lhmobjektID for owner in self.owners)

    def is_allowed_for_user(self, department: str) -> bool:
        """Check if a user with a given department is allowed to use this assistant."""
        # If no hierarchical access restrictions are set, allow everyone
        if not self.hierarchical_access or len(self.hierarchical_access) == 0:
            return True

        # Check if department matches any of the hierarchical access paths
        for access_path in self.hierarchical_access:
            if (
                department == access_path
                or department.startswith(access_path + "-")
                or department.startswith(access_path + "/")
            ):
                return True

        return False

    @property
    def latest_version(self) -> Optional["AssistantVersion"]:
        return self.versions[0] if self.versions else None

    def __repr__(self):
        return f"<Assistant(id='{self.id}')>"


class Owner(Base):
    __tablename__ = "owners"

    lhmobjektID = Column(String(255), primary_key=True)

    assistants = relationship(
        "Assistant", secondary=assistant_owners, back_populates="owners"
    )

    def __repr__(self):
        return f"<Owner(lhmobjektID='{self.lhmobjektID}')>"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    assistant_id = Column(
        String(36), ForeignKey("assistants.id", ondelete="CASCADE"), nullable=False
    )
    lhmobjektID = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    assistant = relationship("Assistant")

    __table_args__ = (
        UniqueConstraint("assistant_id", "lhmobjektID", name="uq_subscription"),
    )

    def __repr__(self):
        return f"<Subscription(assistant_id='{self.assistant_id}', lhmobjektID='{self.lhmobjektID}')>"
