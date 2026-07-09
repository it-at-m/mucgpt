from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PositiveInt


class SummarizeResult(BaseModel):
    """Result model for the summarize endpoint."""

    answer: list[str] = Field(
        ..., description="The summarized text as a list of strings."
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "answer": [
                    "Project status: On track.",
                    "Pending tasks: finalize API docs, complete load tests.",
                ]
            }
        }
    )


class SumRequest(BaseModel):
    """Request model for the summarize endpoint."""

    text: str = Field("", description="The text to summarize.")
    detaillevel: str | None = Field(
        "short",
        description="The desired level of detail for the summary (e.g., 'short', 'medium', 'long').",
    )
    language: str | None = Field("Deutsch", description="The language of the summary.")
    model: str = Field("gpt-4o-mini", description="The model to use for summarization.")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "Das Projekt Meeting behandelte den aktuellen Fortschritt und die nächsten Schritte.",
                "detaillevel": "short",
                "language": "Deutsch",
                "model": "gpt-4o-mini",
            }
        }
    )


class ChatCompletionMessage(BaseModel):
    # follow openai chat completion API model structure

    role: Literal["system", "user", "assistant"] = Field(
        ..., description="Message role: system, user, or assistant"
    )
    content: str = Field(..., description="The message content")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"role": "user", "content": "List three benefits of unit tests."}
        }
    )


class ChatDataSource(BaseModel):
    title: str = Field(..., description="Document title")
    content: str = Field(..., description="Document content to inject")
    metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata for this document"
    )


class ChatCompletionRequest(BaseModel):
    model: str = Field("gpt-4o-mini", description="The model to use")
    messages: list[ChatCompletionMessage] = Field(
        ..., description="Sequence of messages in the conversation"
    )
    temperature: float | None = Field(
        None, description="[DEPRECATED] Sampling temperature - use creativity instead"
    )
    creativity: str | None = Field(
        None,
        description="Creativity level: 'low' (conservative), 'medium' (balanced), 'high' (creative)",
    )
    max_tokens: int | None = Field(4096, description="Maximum tokens to generate")
    stream: bool | None = Field(
        False, description="Whether to stream partial responses back"
    )
    enabled_tools: list[str] | None = Field(
        None, description="List of enabled tool IDs for this completion request"
    )
    assistant_id: str | None = Field(
        None, description="ID of the assistant to use for this completion request"
    )
    data_sources: list[ChatDataSource] | None = Field(
        None,
        description="Structured document payload with title, content and metadata",
    )
    conversation_id: str | None = Field(
        None,
        description=(
            "Optional server-side conversation id. When provided, the incoming "
            "user message and the produced assistant message are persisted to "
            "this conversation, and agent graph state is checkpointed under this "
            "id as the LangGraph thread_id. When omitted, the request is fully "
            "stateless (current default behavior)."
        ),
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are concise."},
                    {"role": "user", "content": "Explain test driven development."},
                ],
                "creativity": "medium",
                "max_tokens": 300,
                "stream": False,
                "enabled_tools": ["Vereinfachen"],
                "assistant_id": "assistant-123",
                "data_sources": [
                    {
                        "title": "Policy-Handbook.pdf",
                        "content": "Document content...",
                        "metadata": {
                            "mime_type": "application/pdf",
                            "size": 123456,
                            "source": "upload",
                        },
                    }
                ],
            }
        }
    )


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatCompletionMessage
    finish_reason: str | None = Field(
        None, description="Why the model stopped generating"
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "TDD ensures code correctness, guides design, and enables refactoring.",
                },
                "finish_reason": "stop",
            }
        }
    )


class Usage(BaseModel):
    prompt_tokens: int = Field(
        ..., description="Number of tokens in the prompt/messages"
    )
    completion_tokens: int = Field(
        ..., description="Number of tokens generated by the model"
    )
    total_tokens: int = Field(..., description="Total tokens consumed")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "prompt_tokens": 120,
                "completion_tokens": 85,
                "total_tokens": 205,
            }
        }
    )


class ChatCompletionResponse(BaseModel):
    id: str = Field(..., description="Unique ID for this completion")
    object: str = Field("chat.completion", description="Type of object returned")
    created: int = Field(..., description="Unix timestamp for creation")
    choices: list[ChatCompletionChoice] = Field(
        ..., description="List of completion choices"
    )
    usage: Usage = Field(..., description="Token usage information")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "chatcmpl-xyz",
                "object": "chat.completion",
                "created": 1710000000,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "TDD improves reliability, supports refactoring, and documents behavior.",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 50,
                    "completion_tokens": 25,
                    "total_tokens": 75,
                },
            }
        }
    )


class ChatCompletionDelta(BaseModel):
    """Incremental content update for streaming responses"""

    role: Literal["system", "user", "assistant"] | None = Field(
        None,
        description="Role indicated when provided (assistant only after initial chunk)",
    )
    content: str | None = Field(None, description="New content for this chunk")
    tool_calls: list[dict] | None = Field(None, description="Tool call information")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "role": "assistant",
                "content": "TDD ensures code quality",
                "tool_calls": [],
            }
        }
    )


class ChatCompletionChunkChoice(BaseModel):
    """A single choice in a streaming chunk"""

    delta: ChatCompletionDelta = Field(..., description="Partial message update")
    index: int = Field(..., description="Choice index, always 0 for single-stream")
    finish_reason: str | None = Field(
        None, description="Why the stream stopped for this choice"
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "delta": {"role": "assistant", "content": "TDD", "tool_calls": []},
                "index": 0,
                "finish_reason": None,
            }
        }
    )


class ChatCompletionChunk(BaseModel):
    """Streaming chunk of chat completion, in ndjson format"""

    id: str = Field(..., description="Same ID as the full completion request")
    object: Literal["chat.completion.chunk"] = Field(
        "chat.completion.chunk", description="Type of object returned"
    )
    created: int = Field(..., description="Unix timestamp for chunk creation")
    choices: list[ChatCompletionChunkChoice] = Field(
        ..., description="List of partial choices for this chunk"
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "chatcmpl-xyz",
                "object": "chat.completion.chunk",
                "created": 1710000001,
                "choices": [
                    {
                        "delta": {
                            "role": "assistant",
                            "content": "TDD",
                            "tool_calls": [],
                        },
                        "index": 0,
                        "finish_reason": None,
                    }
                ],
            }
        }
    )


class ToolInfo(BaseModel):
    """Detailed information about a tool."""

    id: str = Field(..., description="Tool ID.")
    name: str = Field(..., description="Tool name.")
    description: str = Field(..., description="Description of the tool.")
    mcp_source: str | None = Field(
        default=None,
        description="MCP source/server identifier if the tool comes from MCP.",
    )
    mcp_scope: str | None = Field(
        default=None,
        description="Optional MCP scope/group (e.g. jira, confluence).",
    )
    mcp_group: str | None = Field(
        default=None,
        description="Optional group for grouping tools from this MCP source in the frontend (e.g. jira, confluence).",
    )
    # Optionally, add more fields like parameters if needed
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "WEB_SEARCH",
                "name": "Web Search",
                "description": "Search the municipal website for information.",
                "mcp_source": None,
                "mcp_scope": None,
                "mcp_group": None,
            }
        }
    )


class ToolListResponse(BaseModel):
    """Response model for listing available tools with details."""

    tools: list[ToolInfo] = Field(
        ..., description="List of available tools with details."
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tools": [
                    {
                        "id": "WEB_SEARCH",
                        "name": "Web Search",
                        "description": "Search the municipal website for information.",
                        "mcp_group": None,
                    }
                ]
            }
        }
    )


class CreateAssistantRequest(BaseModel):
    """Request model for creating a assistant."""

    input: str = Field(..., description="The input to create the assistant.")
    model: str = Field(
        "gpt-4o-mini", description="The model to use for assistant creation."
    )
    max_tokens: int = Field(
        4096, description="The maximum number of output tokens for the assistant."
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "input": "Create an assistant that answers questions about internal IT policies.",
                "model": "gpt-4o-mini",
                "max_tokens": 1024,
            }
        }
    )


class CreateAssistantResult(BaseModel):
    """Result model for creating a assistant."""

    system_prompt: str = Field(..., description="The system prompt for the assistant.")
    description: str = Field(..., description="The description of the assistant.")
    title: str = Field(..., description="The title of the assistant.")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "system_prompt": "You are an assistant specialized in internal IT policy guidance.",
                "description": "Provides answers about acceptable use, data handling, and security practices.",
                "title": "IT Policy Assistant",
            }
        }
    )


class ModelsDTO(BaseModel):
    llm_name: str = Field(..., description="Identifier of the model/deployment")
    max_output_tokens: PositiveInt | None = Field(
        None, description="Maximum tokens the model can generate"
    )
    max_input_tokens: PositiveInt | None = Field(
        None, description="Maximum tokens the model can receive as input"
    )
    description: str | None = Field(None, description="Human-readable summary")
    input_cost_per_token: Decimal | None = Field(
        None, description="Input pricing information per token"
    )
    output_cost_per_token: Decimal | None = Field(
        None, description="Output pricing information per token"
    )
    supports_function_calling: bool | None = Field(
        None, description="Whether the model supports structured tool/function calls"
    )
    supports_reasoning: bool | None = Field(
        None, description="Whether enhanced reasoning is available"
    )
    supports_vision: bool | None = Field(
        None, description="Whether multimodal vision inputs are supported"
    )
    litellm_provider: str | None = Field(
        None, description="Provider identifier reported by LiteLLM"
    )
    inference_location: str | None = Field(
        None, description="Physical or logical inference region"
    )
    knowledge_cut_off: str | None = Field(
        None, description="Last known training data cutoff for the model"
    )


class ConfigResponse(BaseModel):
    env_name: str = "MUCGPT"
    alternative_logo: bool = False
    models: list[ModelsDTO] = Field(
        default_factory=list,
        description="List of configured language models",
    )
    app_version: str
    core_version: str
    frontend_version: str
    assistant_version: str
    document_processing_enabled: bool = Field(
        False,
        description="Whether document upload and parsing is enabled. True when a parser backend (e.g. Kreuzberg) is configured.",
    )
    transcription_enabled: bool = Field(
        False,
        description="Whether browser-based audio transcription is enabled in the frontend.",
    )
    footer_link_url: str | None = Field(
        None,
        description="URL for the footer link.",
    )
    footer_label: str | None = Field(
        None,
        description="Label for the footer link.",
    )
    faq_url: str | None = Field(
        None,
        description="URL for the FAQ link.",
    )
    incident_report_url: str | None = Field(
        None,
        description="URL for the incident report link.",
    )
    feature_request_url: str | None = Field(
        None,
        description="URL for the feature request link.",
    )
    contact_mail_url: str | None = Field(
        None,
        description="URL for the contact mail link.",
    )
    ad2image_url: str | None = Field(
        None,
        description="Base URL of the ad2image service for Gravatar-compatible avatar images.",
    )


# ---------------------------------------------------------------------------
# Server-side conversation persistence (chat store)
# ---------------------------------------------------------------------------


class ConversationSummary(BaseModel):
    """List-view representation of a conversation (without messages)."""

    id: str
    title: str | None = None
    favorite: bool = False
    assistant_id: str | None = None
    model: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConversationDetail(ConversationSummary):
    """Full conversation including ordered messages."""

    messages: list[ChatCompletionMessage] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class CreateConversationRequest(BaseModel):
    """Payload to create a new conversation."""

    id: str | None = Field(
        None,
        description=(
            "Optional client-supplied conversation id (e.g. a UUID generated by "
            "the frontend). Used so the same id is shared end-to-end; omit to let "
            "the server generate one."
        ),
    )
    title: str | None = Field(None, description="Optional human-readable title")
    assistant_id: str | None = Field(
        None, description="Assistant this conversation belongs to, if any"
    )
    model: str | None = Field(None, description="Default model for the conversation")
    config: dict[str, Any] | None = Field(
        None, description="Optional snapshot of chat config (creativity, tools, ...)"
    )
    messages: list[ChatCompletionMessage] = Field(
        default_factory=list, description="Optional initial messages"
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Onboarding questions",
                "assistant_id": None,
                "model": "gpt-4o-mini",
                "messages": [],
            }
        }
    )


class UpdateConversationRequest(BaseModel):
    """PATCH payload for conversation metadata. Only provided fields change."""

    title: str | None = None
    favorite: bool | None = None
    model_config = ConfigDict(
        json_schema_extra={"example": {"title": "Renamed chat", "favorite": True}}
    )


class AppendMessageRequest(BaseModel):
    """Append a single message to a conversation."""

    message: ChatCompletionMessage
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"message": {"role": "user", "content": "Hello!"}}
        }
    )


class ConversationStateResponse(BaseModel):
    """Checkpointed LangGraph agent state for a conversation thread."""

    conversation_id: str
    has_checkpoint: bool = Field(
        ..., description="Whether any checkpoint exists for this thread_id yet"
    )
    messages: list[ChatCompletionMessage] = Field(
        default_factory=list,
        description="Messages recorded in the agent graph state",
    )
    next: list[str] = Field(
        default_factory=list,
        description="Pending next nodes (non-empty when a run was interrupted)",
    )
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "conversation_id": "1f2e...",
                "has_checkpoint": True,
                "messages": [
                    {"role": "user", "content": "Hi"},
                    {"role": "assistant", "content": "Hello!"},
                ],
                "next": [],
            }
        }
    )
