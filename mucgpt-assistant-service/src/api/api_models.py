# Pydantic models for request/response validation
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Reset password",
                "value": "How can I reset my password?",
            }
        }


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

    class Config:
        json_schema_extra = {
            "example": {
                "label": "Troubleshoot Connection",
                "prompt": "Help me troubleshoot a network connection issue",
                "tooltip": "Use this prompt to quickly get help with network issues",
            }
        }


class ToolBase(BaseModel):
    """Response model for an assistant tool.

    Contains the ID and the configuration of the tool.
    """

    id: str = Field(
        ..., description="Unique identifier for the tool", example="WEB_SEARCH"
    )
    config: Optional[Dict[str, Any]] = Field(
        None,
        description="Tool-specific configuration settings",
        example={"url": "muenchen.de", "max_results": 5},
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "WEB_SEARCH",
                "config": {"url": "muenchen.de", "max_results": 5},
            }
        }


class AssistantBase(BaseModel):
    """Base model for AI assistants with comprehensive configuration options.

    This model contains all the core properties that define an AI assistant's
    behavior, capabilities, and metadata.
    """

    name: str = Field(
        ...,
        description="The name/title of the assistant",
        example="Technical Support Bot",
    )

    description: Optional[str] = Field(
        "",
        description="A detailed description of the assistant's purpose and capabilities",
        example="An AI assistant specialized in providing technical support for software issues",
    )

    system_prompt: str = Field(
        ...,
        description="The system prompt that defines the assistant's personality and behavior",
        example="You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
    )
    hierarchical_access: Optional[List[str]] = Field(
        [],
        description="Hierarchical access control paths for organizational permissions. All users under these hierarchies can access the assistant. Leave empty for no restrictions.",
        example=["department-underdepartment", "anotherdepartment"],
    )
    temperature: float = Field(
        0.7,
        description="Controls randomness in AI responses (0.0 = deterministic, 1.0 = very random)",
        ge=0.0,
        le=2.0,
        example=0.7,
    )
    max_output_tokens: int = Field(
        1000,
        description="Maximum number of tokens the assistant can generate in a single response",
        gt=0,
        example=1000,
    )
    examples: Optional[List[ExampleModel]] = Field(
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
    quick_prompts: Optional[List[QuickPrompt]] = Field(
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
    tags: Optional[List[str]] = Field(
        [],
        description="Tags for categorizing and filtering assistants",
        example=["support", "technical", "customer-service"],
    )

    tools: Optional[List[ToolBase]] = Field(
        [],
        description="List of toos that this assistant can use",
        example=[
            {"id": "WEB_SEARCH", "config": {"url": "muenchen.de", "max_results": 5}}
        ],
    )
    owner_ids: Optional[List[str]] = Field(
        [],
        description="List of lhmobjektIDs who will own this assistant",
        example=["12345", "67890"],
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Technical Support Bot",
                "description": "An AI assistant specialized in providing technical support for software issues",
                "system_prompt": "You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
                "hierarchical_access": [
                    "department-underdepartment",
                    "anotherdepartment-underdepartment",
                ],
                "temperature": 0.7,
                "max_output_tokens": 1000,
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


class AssistantCreate(AssistantBase):
    """Model for creating a new AI assistant.

    This extends AssistantBase with fields for specifying tools and owners
    during assistant creation.
    """

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Customer Service Bot",
                "description": "AI assistant for handling customer inquiries",
                "system_prompt": "You are a friendly customer service representative. Always be helpful and empathetic.",
                "temperature": 0.5,
                "max_output_tokens": 800,
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

    name: Optional[str] = Field(
        None,
        description="The name/title of the assistant",
        example="Technical Support Bot",
    )

    description: Optional[str] = Field(
        None,
        description="A detailed description of the assistant's purpose and capabilities",
        example="An AI assistant specialized in providing technical support for software issues",
    )

    system_prompt: Optional[str] = Field(
        None,
        description="The system prompt that defines the assistant's personality and behavior",
        example="You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
    )
    hierarchical_access: Optional[List[str]] = Field(
        None,
        description="Hierarchical access control paths for organizational permissions. All users under these hierarchies can access the assistant. Leave empty for no restrictions.",
        example=["department-underdepartment", "anotherdepartment"],
    )
    temperature: Optional[float] = Field(
        None,
        description="Controls randomness in AI responses (0.0 = deterministic, 1.0 = very random)",
        ge=0.0,
        le=2.0,
        example=0.7,
    )
    max_output_tokens: Optional[int] = Field(
        None,
        description="Maximum number of tokens the assistant can generate in a single response",
        gt=0,
        example=1000,
    )
    examples: Optional[List[ExampleModel]] = Field(
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
    quick_prompts: Optional[List[QuickPrompt]] = Field(
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
    tags: Optional[List[str]] = Field(
        None,
        description="Tags for categorizing and filtering assistants",
        example=["support", "technical", "customer-service"],
    )

    tools: Optional[List[ToolBase]] = Field(
        None,
        description="List of toos that this assistant can use",
        example=[
            {"id": "WEB_SEARCH", "config": {"url": "muenchen.de", "max_results": 5}}
        ],
    )
    owner_ids: Optional[List[str]] = Field(
        None,
        description="List of lhmobjektIDs who will own this assistant",
        example=["12345", "67890"],
    )


class AssistantVersionResponse(AssistantBase):
    """Response model for a specific version of an AI assistant."""

    id: int = Field(
        ...,
        description="Unique identifier for the assistant version",
        example=1,
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
    hierarchical_access: Optional[List[str]] = Field(
        [],
        description="Hierarchical access control paths for organizational permissions. All users under these hierarchies can access the assistant. Leave empty for no restrictions.",
        example=["department-underdepartment", "anotherdepartment-underdepartment"],
    )
    owner_ids: Optional[List[str]] = Field(
        [],
        description="List of lhmobjektIDs who will own this assistant",
        example=["12345", "67890"],
    )
    latest_version: AssistantVersionResponse = Field(
        ..., description="The latest version of the assistant"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "created_at": "2025-06-18T10:30:00Z",
                "updated_at": "2025-06-18T15:45:00Z",
                "hierarchical_access": [
                    "department-underdepartment",
                    "anotherdepartment-underdepartment",
                ],
                "owner_ids": ["12345", "67890"],
                "latest_version": {
                    "id": 1,
                    "version": 1,
                    "created_at": "2025-06-18T10:30:00Z",
                    "name": "Technical Support Bot",
                    "description": "An AI assistant specialized in providing technical support for software issues",
                    "system_prompt": "You are a helpful technical support assistant. Always be professional and provide step-by-step solutions.",
                    "temperature": 0.7,
                    "max_output_tokens": 1000,
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
        }


class StatusResponse(BaseModel):
    """Standard status message response model."""

    message: str


class SubscriptionResponse(BaseModel):
    """Simple response model for subscribed assistants containing only ID and name."""

    id: str = Field(
        ...,
        description="Unique identifier for the assistant (UUID v4)",
        example="123e4567-e89b-12d3-a456-426614174000",
    )
    name: str = Field(
        ...,
        description="The name/title of the assistant",
        example="Technical Support Bot",
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Technical Support Bot",
            }
        }
