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
    assistant_id = Column(
        Integer, ForeignKey("assistants.id", ondelete="CASCADE"), primary_key=True
    )
    tool_id = Column(
        String(255), ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True
    )
    config = Column(JSON, nullable=True)

    assistant = relationship("Assistant", back_populates="tool_associations")
    tool = relationship("Tool", back_populates="assistant_associations")

    def __repr__(self):
        return f"<AssistantTool(assistant_id={self.assistant_id}, tool_id='{self.tool_id}')>"


class Assistant(Base):
    __tablename__ = "assistants"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)  # maps to "title" in frontend
    description = Column(Text)
    system_prompt = Column(Text, nullable=False)  # maps to "system_message" in frontend
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hierarchical_access = Column(String(1000))

    temperature = Column(Float, default=0.7)
    max_output_tokens = Column(Integer, default=1000)
    version = Column(String(50), default="1.0")
    examples = Column(JSON, nullable=True)  # Store ExampleModel[] as JSON
    quick_prompts = Column(JSON, nullable=True)  # Store QuickPrompt[] as JSON
    tags = Column(JSON, nullable=True)  # Store string[] as JSON

    # Relationships to association objects
    tool_associations = relationship(
        "AssistantTool", back_populates="assistant", cascade="all, delete-orphan"
    )

    @property
    def tools(self):
        """Return a list of tool configurations for the assistant."""
        return [
            {"id": assoc.tool.id, "config": assoc.config}
            for assoc in self.tool_associations
        ]

    # Many-to-many relationship with owners through assistant_owners table
    owners = relationship(
        "Owner", secondary=assistant_owners, back_populates="assistants"
    )

    def is_owner(self, lhmobjektID: str) -> bool:
        """Check if the given lhmobjektID is an owner of this assistant."""
        return any(owner.lhmobjektID == lhmobjektID for owner in self.owners)

    def __repr__(self):
        return f"<Assistant(name='{self.name}')>"


class Owner(Base):
    __tablename__ = "owners"

    lhmobjektID = Column(String(255), primary_key=True)

    # Many-to-many relationship with assistants through assistant_owners table
    assistants = relationship(
        "Assistant", secondary=assistant_owners, back_populates="owners"
    )

    def __repr__(self):
        return f"<Owner(lhmobjektID='{self.lhmobjektID}')>"
