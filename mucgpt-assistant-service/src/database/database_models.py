from datetime import datetime
from typing import TypeVar

from sqlalchemy import (
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
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

Base = declarative_base()
ModelType = TypeVar("ModelType", bound=Base)  # type: ignore # Define a TypeVar for the model

assistant_owners = Table(
    "assistant_owners",
    Base.metadata,
    Column(
        "assistant_id",
        Integer,
        ForeignKey("assistants.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("lhmobjektID", String(255), primary_key=True),
    UniqueConstraint("assistant_id", "lhmobjektID", name="uq_assistant_owner"),
)


class Tool(Base):
    __tablename__ = "tools"

    id = Column(String(255), primary_key=True)
    description = Column(Text, nullable=True)

    assistant_associations = relationship(
        "AssistantTool", back_populates="tool", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Tool(id='{self.id}')>"


class AssistantTool(Base):
    __tablename__ = "assistant_tools"
    assistant_version_id = Column(
        Integer,
        ForeignKey("assistant_versions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tool_id = Column(
        String(255), ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True
    )
    config = Column(JSON, nullable=True)

    assistant_version = relationship(
        "AssistantVersion", back_populates="tool_associations"
    )
    tool = relationship("Tool", back_populates="assistant_associations")

    def __repr__(self):
        return f"<AssistantTool(assistant_version_id={self.assistant_version_id}, tool_id='{self.tool_id}')>"


class AssistantVersion(Base):
    __tablename__ = "assistant_versions"

    id = Column(Integer, primary_key=True)
    assistant_id = Column(
        Integer, ForeignKey("assistants.id", ondelete="CASCADE"), nullable=False
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

    @property
    def tools(self):
        """Return a list of tool configurations for the assistant version."""
        return [
            {"id": assoc.tool.id, "config": assoc.config}
            for assoc in self.tool_associations
        ]

    __table_args__ = (
        UniqueConstraint("assistant_id", "version", name="uq_assistant_version"),
    )

    def __repr__(self):
        return f"<AssistantVersion(assistant_id={self.assistant_id}, version='{self.version}')>"


class Assistant(Base):
    __tablename__ = "assistants"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hierarchical_access = Column(String(1000))

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
        if not self.hierarchical_access or self.hierarchical_access == "":
            return True
        return department.startswith(self.hierarchical_access)

    @property
    def latest_version(self) -> "AssistantVersion | None":
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
