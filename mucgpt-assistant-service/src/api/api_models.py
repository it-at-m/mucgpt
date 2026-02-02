# Pydantic models for request/response validation
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field  # added ConfigDict


class ExampleModel(BaseModel):
    text: str = Field(
        ...,
        description="The display text for the example",
        example="Reset password",
    )
    value: str = Field(
        ...,
        description="The actual prompt value for the example",
        example="How can I reset my password?",
    )

    # replaced inner Config with model_config
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "Reset password",
                "value": "How can I reset my password?",
            }
        }
    )


class DirectoryNode(BaseModel):
    """Simplified organization unit for frontend consumption."""

    shortname: str | None = Field(
        None,
        description="Short identifier (e.g., lhmOUShortname)",
        example="S-III-U/BNF21",
    )
    name: str = Field(
        ..., description="Human readable name of the org unit", example="Team 2.1A"
    )
    children: list[DirectoryNode] | None = Field(
        default=None, description="Child organization units"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "shortname": "S-III-U/BNF21",
                "name": "NQ Tollkirschenweg 6",
                "children": [
                    {"shortname": "S-III-U/BNF21A", "name": "Team 2.1A", "children": []}
                ],
            }
        }
    )


class QuickPrompt(BaseModel):
    label: str = Field(
        ...,
        description="The label for the quick prompt button",
        example="Troubleshoot Connection",
    )
    prompt: str = Field(
        ...,
        description="The prompt to be sent when the quick prompt is used",
        example="Help me troubleshoot a network connection issue",
    )
    tooltip: str = Field(
        "",
        description="A tooltip to display for the quick prompt",
        example="Use this prompt to quickly get help with network issues",
    )

    # replaced inner Config with model_config
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "label": "Troubleshoot Connection",
                "prompt": "Help me troubleshoot a network connection issue",
                "tooltip": "Use this prompt to quickly get help with network issues",
            }
        }
    )


class ToolBase(BaseModel):
    """Response model for an assistant tool.

    Contains the ID and the configuration of the tool.
    """

    id: str = Field(
        ..., description="Unique identifier for the tool", example="WEB_SEARCH"
    )
    config: dict[str, Any] | None = Field(
        None,
        description="Tool-specific configuration settings",
        example={"url": "muenchen.de", "max_results": 5},
    )

    # replaced inner Config with model_config
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "WEB_SEARCH",
                "config": {"url": "muenchen.de", "max_results": 5},
            }
        },
    )


class AssistantBase(BaseModel):
    """Base model for AI assistants with comprehensive configuration options.

    This model contains all the core properties that define an AI assistant's
    behavior, capabilities, and metadata.
    """

    name: str = Field(
        ...,
        description="The name/title of the assistant",
        example="Technical Support Assistant",
    )

    description: str | None = Field(
        "",
        description="A detailed description of the assistant's purpose and capabilities",
        example="An AI assistant specialized in providing technical support for software issues",
    )

    system_prompt: str = Field(
        ...,
        description="The system prompt that defines the assistant's personality and behavior",
        example="You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
    )
    hierarchical_access: list[str] | None = Field(
        [],
        description="Hierarchical access control paths for organizational permissions. All users under these hierarchies can access the assistant. Leave empty for no restrictions.",
        example=["department-underdepartment", "anotherdepartment"],
    )
    creativity: str = Field(
        "medium",
        description="Controls creativity/randomness in AI responses. Must be one of: 'low' (conservative), 'medium' (balanced), 'high' (creative)",
        pattern="^(low|medium|high)$",
        example="medium",
    )
    default_model: str | None = Field(
        None,
        description="The default AI model to use for this assistant",
        example="gpt-4",
    )
    examples: list[ExampleModel] | None = Field(
        [],
        description="Example conversations starters",
        example=[
            {"text": "Reset password", "value": "How can i reset my password?"},
            {
                "text": "Network Issue",
                "value": "Help me troubleshoot a network connection issue",
            },
        ],
    )
    quick_prompts: list[QuickPrompt] | None = Field(
        [],
        description="Pre-defined quick prompts/actions for the assistant",
        example=[
            {
                "label": "Troubleshoot Connection",
                "prompt": "Help me troubleshoot a network connection issue",
                "tooltip": "Use this prompt to quickly get help with network issues",
            }
        ],
    )
    tags: list[str] | None = Field(
        [],
        description="Tags for categorizing and filtering assistants",
        example=["support", "technical", "customer-service"],
    )

    is_visible: bool | None = Field(
        True,
        description="Whether this assistant is publicly listed in the UI",
        example=True,
    )

    tools: list[ToolBase] | None = Field(
        [],
        description="List of toos that this assistant can use",
        example=[
            {"id": "WEB_SEARCH", "config": {"url": "muenchen.de", "max_results": 5}}
        ],
    )
    owner_ids: list[str] | None = Field(
        [],
        description="List of ids who will own this assistant",
        example=["12345", "67890"],
    )

    # replaced inner Config with model_config
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Technical Support Assistant",
                "description": "An AI assistant specialized in providing technical support for software issues",
                "system_prompt": "You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
                "hierarchical_access": [
                    "department-underdepartment",
                    "anotherdepartment-underdepartment",
                ],
                "creativity": "medium",
                "default_model": "gpt-4",
                "tools": [
                    {
                        "id": "WEB_SEARCH",
                        "config": {"url": "muenchen.de", "max_results": 5},
                    }
                ],
                "owner_ids": ["12345"],
                "examples": [
                    {"text": "Reset password", "value": "How can i reset my password?"},
                    {
                        "text": "Network Issue",
                        "value": "Help me troubleshoot a network connection issue",
                    },
                ],
                "quick_prompts": [
                    {
                        "label": "Troubleshoot Connection",
                        "prompt": "Help me troubleshoot a network connection issue",
                        "tooltip": "Use this prompt to quickly get help with network issues",
                    }
                ],
                "tags": ["support", "technical", "customer-service"],
            }
        }
    )


class AssistantCreate(AssistantBase):
    """Model for creating a new AI assistant.

    This extends AssistantBase with fields for specifying tools and owners
    during assistant creation.
    """

    # replaced inner Config with model_config
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Customer Service Assistant",
                "description": "AI assistant for handling customer inquiries",
                "system_prompt": "You are a friendly customer service representative. Always be helpful and empathetic.",
                "creativity": "low",
                "default_model": "gpt-4",
                "tools": [
                    {
                        "id": "WEB_SEARCH",
                        "config": {"url": "muenchen.de", "max_results": 5},
                    }
                ],
                "owner_ids": ["12345"],
                "examples": [
                    {"text": "Reset password", "value": "How can i reset my password?"},
                    {
                        "text": "Network Issue",
                        "value": "Help me troubleshoot a network connection issue",
                    },
                ],
                "quick_prompts": [
                    {
                        "label": "Troubleshoot Connection",
                        "prompt": "Help me troubleshoot a network connection issue",
                        "tooltip": "Use this prompt to quickly get help with network issues",
                    }
                ],
                "tags": ["customer-service", "support"],
            }
        }
    )


class AssistantUpdate(BaseModel):
    """Model for updating an existing AI assistant.

    All fields are optional to allow partial updates. Only provided fields
    will be updated, leaving others unchanged.
    """

    version: int = Field(
        ...,
        description="The version of the assistant being updated, to prevent conflicts.",
        example=1,
    )

    name: str | None = Field(
        None,
        description="The name/title of the assistant",
        example="Technical Support Assistant",
    )

    description: str | None = Field(
        None,
        description="A detailed description of the assistant's purpose and capabilities",
        example="An AI assistant specialized in providing technical support for software issues",
    )

    system_prompt: str | None = Field(
        None,
        description="The system prompt that defines the assistant's personality and behavior",
        example="You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
    )
    hierarchical_access: list[str] | None = Field(
        None,
        description="Hierarchical access control paths for organizational permissions. All users under these hierarchies can access the assistant. Leave empty for no restrictions.",
        example=["department-underdepartment", "anotherdepartment"],
    )
    creativity: str | None = Field(
        None,
        description="Controls creativity/randomness in AI responses. Must be one of: 'low' (conservative), 'medium' (balanced), 'high' (creative)",
        pattern="^(low|medium|high)$",
        example="medium",
    )
    default_model: str | None = Field(
        None,
        description="The default AI model to use for this assistant",
        example="gpt-4",
    )
    examples: list[ExampleModel] | None = Field(
        None,
        description="Example conversations starters",
        example=[
            {"text": "Reset password", "value": "How can i reset my password?"},
            {
                "text": "Network Issue",
                "value": "Help me troubleshoot a network connection issue",
            },
        ],
    )
    quick_prompts: list[QuickPrompt] | None = Field(
        None,
        description="Pre-defined quick prompts/actions for the assistant",
        example=[
            {
                "label": "Troubleshoot Connection",
                "prompt": "Help me troubleshoot a network connection issue",
                "tooltip": "Use this prompt to quickly get help with network issues",
            }
        ],
    )
    tags: list[str] | None = Field(
        None,
        description="Tags for categorizing and filtering assistants",
        example=["support", "technical", "customer-service"],
    )

    is_visible: bool | None = Field(
        None,
        description="Whether this assistant is publicly listed in the UI",
        example=True,
    )

    tools: list[ToolBase] | None = Field(
        None,
        description="List of toos that this assistant can use",
        example=[
            {"id": "WEB_SEARCH", "config": {"url": "muenchen.de", "max_results": 5}}
        ],
    )
    owner_ids: list[str] | None = Field(
        None,
        description="List of ids who will own this assistant",
        example=["12345", "67890"],
    )


class AssistantVersionResponse(AssistantBase):
    """Response model for a specific version of an AI assistant."""

    # added model_config for from_attributes
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(
        ...,
        description="Unique identifier for the assistant version",
        example="123e4567-e89b-12d3-a456-426614174000",
    )
    version: int = Field(
        ...,
        description="Version number of the assistant configuration",
        example=1,
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp when this version was created",
        example="2025-06-18T10:30:00Z",
    )


class AssistantResponse(BaseModel):
    """Complete response model for AI assistant data.

    This includes all assistant properties plus database-generated fields
    like ID, timestamps, and related entities (tools and owners).
    """

    id: str = Field(
        ...,
        description="Unique identifier for the assistant (UUID v4)",
        example="123e4567-e89b-12d3-a456-426614174000",
    )

    created_at: datetime = Field(
        ...,
        description="Timestamp when the assistant was created",
        example="2025-06-18T10:30:00Z",
    )

    updated_at: datetime = Field(
        ...,
        description="Timestamp when the assistant was last updated",
        example="2025-06-18T15:45:00Z",
    )
    hierarchical_access: list[str] | None = Field(
        [],
        description="Hierarchical access control paths for organizational permissions. All users under these hierarchies can access the assistant. Leave empty for no restrictions.",
        example=["department-underdepartment", "anotherdepartment-underdepartment"],
    )
    is_visible: bool = Field(
        True,
        description="Whether this assistant is publicly listed in the UI",
        example=True,
    )
    owner_ids: list[str] | None = Field(
        [],
        description="List of ids who will own this assistant",
        example=["12345", "67890"],
    )
    subscriptions_count: int = Field(
        0,
        description="Number of users subscribed to this assistant",
        example=42,
    )
    latest_version: AssistantVersionResponse = Field(
        ..., description="The latest version of the assistant"
    )

    # replaced inner Config with model_config
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "created_at": "2025-06-18T10:30:00Z",
                "updated_at": "2025-06-18T15:45:00Z",
                "hierarchical_access": [
                    "department-underdepartment",
                    "anotherdepartment-underdepartment",
                ],
                "is_visible": True,
                "owner_ids": ["12345", "67890"],
                "subscriptions_count": 42,
                "latest_version": {
                    "id": 1,
                    "version": 1,
                    "created_at": "2025-06-18T10:30:00Z",
                    "name": "Technical Support Assistant",
                    "description": "An AI assistant specialized in providing technical support for software issues",
                    "system_prompt": "You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
                    "creativity": "medium",
                    "default_model": "gpt-4",
                    "tools": [
                        {
                            "id": "WEB_SEARCH",
                            "config": {"url": "muenchen.de", "max_results": 5},
                        }
                    ],
                    "owner_ids": ["12345"],
                    "examples": [
                        {
                            "text": "Reset password",
                            "value": "How can i reset my password?",
                        },
                        {
                            "text": "Network Issue",
                            "value": "Help me troubleshoot a network connection issue",
                        },
                    ],
                    "quick_prompts": [
                        {
                            "label": "Troubleshoot Connection",
                            "prompt": "Help me troubleshoot a network connection issue",
                            "tooltip": "Use this prompt to quickly get help with network issues",
                        }
                    ],
                    "tags": ["support", "technical", "customer-service"],
                },
            }
        },
    )


class StatusResponse(BaseModel):
    """Standard status message response model."""

    message: str


class SubscriptionResponse(BaseModel):
    """Simple response model for subscribed assistants containing only ID, name and description."""

    id: str = Field(
        ...,
        description="Unique identifier for the assistant (UUID v4)",
        example="123e4567-e89b-12d3-a456-426614174000",
    )
    title: str = Field(
        ...,
        description="The name/title of the assistant",
        example="Technical Support Assistant",
    )
    description: str = Field(
        ...,
        description="A brief description of the assistant's purpose",
        example="An AI assistant specialized in providing technical support for software issues",
    )

    # replaced inner Config with model_config
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "Technical Support Assistant",
                "description": "An AI assistant specialized in providing technical support for software issues",
            }
        },
    )
