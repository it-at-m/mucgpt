from __future__ import annotations
import os
from typing import Any

from langchain.agents.middleware import ModelRequest
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from agent.state_models.atlassian_state import AtlassianAgentState, ScopeDecision
from core.logtools import getLogger

logger = getLogger(name="agent-policies")


def _tool_scope(tool: Any) -> str | None:
    """Infer the MCP scope for a tool from metadata or name."""
    metadata = getattr(tool, "metadata", None)
    if isinstance(metadata, dict):
        scoped = metadata.get("mcp_scope")
        if scoped:
            normalized = str(scoped).strip().lower()
            if normalized in {"jira", "confluence"}:
                return normalized

    tool_name = str(getattr(tool, "name", "")).strip().lower()
    if "jira" in tool_name:
        return "jira"
    if "confluence" in tool_name:
        return "confluence"
    return None

def _last_messages(request: ModelRequest, n: int = 4) -> list[Any]:
    return list((request.messages or [])[-n:])


def _message_type(message: Any) -> str:
    return str(getattr(message, "type", "")).strip().lower()


def _extract_message_text(message: Any) -> str:
    """
    Best-effort extraction of user-visible text from LangChain-style messages.
    Supports:
    - content as str
    - text attribute
    - content as list[str | dict]
    """
    content = getattr(message, "content", None)
    if isinstance(content, str) and content.strip():
        return content.strip()

    text = getattr(message, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str) and item.strip():
                parts.append(item.strip())
                continue

            if isinstance(item, dict):
                item_text = item.get("text")
                if isinstance(item_text, str) and item_text.strip():
                    parts.append(item_text.strip())

        return "\n".join(parts).strip()

    return ""



class DefaultScopePolicy:
    """Default no-op policy: keep all tools and use general scope."""

    def __init__(self) -> None:
        pass

    def infer_scope(
        self,
        request: ModelRequest,
    ) -> ModelRequest:
        return request
    
    async def ainfer_scope(
        self,
        request: ModelRequest,
    ) -> ModelRequest:
        return request

    def select_tools(
        self,
        request: ModelRequest,
    ) -> list[Any]:
        return list(request.tools or [])

    def modify_system_message(self, system_text: str, scope: str) -> str:
        return system_text


class AtlassianScopePolicy(DefaultScopePolicy):
    """
    Scope policy for Atlassian assistants.

    Behavior:
    - TODO: use persistent state in the future to avoid re-inferring scope on every turn. (Requires stateful frontend)
    """
    _use_static_scope_selection = False  # switch between static and dynamic (model driven) scope selection
    DEFAULT_SCOPE = "general"
    VALID_SCOPES = {"jira", "confluence", "general"}
    SCOPE_CONTEXT_PREFIX = "[CONTEXT] Current MCP scope is:"

    # Frontend starter example -> fixed scope mapping.
    # NOTE: Adjust this if the frontend examples change!
    # TODO: set these via agent state through frontend instead of hardcoding here
    INITIAL_EXAMPLE_SCOPE_MAP: dict[str, str] = {
        "jira": "jira",
        "confluence": "confluence",
        "wissensassistent": "general",
    }
    

    def __init__(self, model: ChatOpenAI | str = "gpt-4.1-nano") -> None:
        super().__init__()
        self.model = model if isinstance(model, ChatOpenAI) else ChatOpenAI(model=model, streaming=False, disable_streaming=True)
        self.model = self.model.with_structured_output(ScopeDecision)
        self.router_prompt: str | None = None
        current_dir = os.path.dirname(__file__)
        path_parts = current_dir.split(os.sep)
        if "agent" in path_parts:
            agent_index = path_parts.index("agent")
            agent_dir = os.sep.join(path_parts[:agent_index + 1])
        else:
            # If 'agent' is not found, you can go up manually, e.g., two levels up
            # Adjust this as needed
            agent_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "agent"))
        target_path = os.path.join(agent_dir, "prompt_pool", "atlassian_scope_router.md")
        if os.path.exists(target_path):
            with open(target_path) as f:
                self.router_prompt = f.read()



    def _try_initial_scope(
        self,
        request: ModelRequest,
    ) -> ModelRequest:
        state = request.state
        checked = state.get("initial_scope_checked", False)
        if checked:
            return request
        
        _first_user_message = next((msg for msg in request.messages if _message_type(msg) in {"human", "user"}), None)
        if not _first_user_message:
            logger.info("No messages in request; skipping initial scope check.")
            logger.info(f"Request: {request}")
            return request
        
        if _first_user_message.content in self.VALID_SCOPES:
            locked_scope = _first_user_message.content
            logger.info("Locking initial scope to '%s' based on first user message.", locked_scope)
            new_state = {
                "initial_scope_checked": True,
                "locked_scope": locked_scope,
                "current_scope": locked_scope,
                "scope_confidence": 1.0,
            }
            new_state = AtlassianAgentState(**{**state, **new_state})
            request = request.override(state=new_state)
        return request

    def _set_chat_scope(
        self,
        request: ModelRequest,
    ) -> ModelRequest:
        # return the request unmodified if scope already locked or checked to avoid redundant processing
        # NOTE: works only when stateful
        logger.debug(f"Checking initial scope for request. Current state: {list(request.state.keys())}")
        if request.state.get("initial_scope_checked"):
            return request
        state_update: dict[str, Any] = {"initial_scope_checked": True}

        # check the first user message if it is a predefined example
        first_user_message = next((msg for msg in request.messages if _message_type(msg) in {"human", "user"}), None)
        if first_user_message:
            if self.INITIAL_EXAMPLE_SCOPE_MAP.get(first_user_message.text.strip().lower()) in self.VALID_SCOPES:
                locked_scope = self.INITIAL_EXAMPLE_SCOPE_MAP[first_user_message.text.strip().lower()]
                logger.debug("Locking initial scope to '%s' based on first user message.", locked_scope)
                update = {
                    "locked_scope": locked_scope,
                    "current_scope": locked_scope,
                    "scope_confidence": 1.0,
                }
                state_update.update(update)
            else:
                update = {
                    "locked_scope": self.DEFAULT_SCOPE,
                    "current_scope": self.DEFAULT_SCOPE,
                }
                state_update.update(update)
        
        new_state: AtlassianAgentState = AtlassianAgentState(**{**request.state, **state_update})
        request = request.override(state=new_state)
        return request



    async def ainfer_scope(
        self,
        request: ModelRequest,
    ) -> ModelRequest:
        # NOTE: currently the frontend is stateless!
        #       this means that there is no agent state persisted across messages, so we have to infer the scope from the message history on every turn.
        #       in the future, once we have a stateful frontend, we can rely more on the agent state

        if self._use_static_scope_selection:
            request = self._set_chat_scope(request)
            if not request.state.get("current_scope"):
                raise ValueError("Initial scope check failed.")
            return request



        # skipping scope inference will be possible if the frontend becomes stateful
        # last_message = request.messages[-1] if request.messages else None
        # last_type = _message_type(last_message) if last_message is not None else ""
        # if self.model is None or last_type not in {"human", "user"}: # skip assistant messages and tool calls to save tokens
        #     logger.info("Skipping scope inference for message type '%s'.", last_type)
        #     return request
        

        system_prompt = self.router_prompt if self.router_prompt is not None else "classify the scope of this conversation into one of the following categories: jira, confluence, general. focus on the most recent conversation"
        n = 6 # TODO: set dynamically or via config
        messages = [
            {"role": "system", "content": system_prompt},
            *[
                {
                    "role": "user" if _message_type(m) in {"human", "user"} else "assistant",
                    "content": f"Message {i + 1}: {_extract_message_text(m)}",
                }
                for i, m in enumerate(_last_messages(request, n))
                if _extract_message_text(m) and _message_type(m) in {"human", "user", "assistant"}
            ],
        ]

        try:
            result: ScopeDecision = await self.model.ainvoke(
                messages,
                config={
                    "callbacks": [],
                    "run_name": "internal_scope_router",
                    "tags": ["internal", "scope-router"],
                    "metadata": {
                        "internal": True,
                        "stream_to_user": False,
                    },
                    "configurable": {
                        "llm_streaming": False,
                    },
                },
            ) # type: ignore
            scope = result.scope.lower()
            confidence = result.confidence
            logger.debug(f"Model inferred scope '{scope}' with confidence {confidence:.2f}")

            # fallback to general if confidence is low
            scope = self.DEFAULT_SCOPE if confidence < 0.5 else scope
        except Exception:
            logger.exception("Scope routing model failed; falling back to default scope.")
            scope = self.DEFAULT_SCOPE
            confidence = 0.0

        if scope not in self.VALID_SCOPES:
            scope = self.DEFAULT_SCOPE

        state_update = {
            "current_scope": scope,
            "scope_confidence": confidence,
        }
        new_state: AtlassianAgentState = AtlassianAgentState(**{**request.state, **state_update})
        logger.info(f"Updating agent state with inferred scope. {new_state["current_scope"]}")
        request = request.override(state=new_state)
        return request

    def select_tools(
        self,
        request: ModelRequest,
    ) -> list[Any]:
        tools = list(request.tools or [])
        logger.info(f"Selecting tools based on current scope '{request.state.get('current_scope', 'No scope set')}' and {len(tools)} available tools.")
        if request.state.get("current_scope", self.DEFAULT_SCOPE) == self.DEFAULT_SCOPE:
            return tools

        selected: list[Any] = []
        for tool in tools:
            tool_scope = _tool_scope(tool)
            if tool_scope is None:
                selected.append(tool)
            elif tool_scope == request.state.get("current_scope", "general"):
                selected.append(tool)

        return selected or tools

    def modify_system_message(self, system_text: str, scope: str) -> str:
        """Append the active MCP scope once so the model sees the current tool context."""
        # NOTE: this is currently just a example 
        # the function can be used to dynamically modify the system prompt based on the active scope
        # for example, we could add specific instructions or information about the tools available in the current scope to guide the model's behavior
        # or completely replace the system prompt with a scope-specific one
        cleaned = system_text.strip()

        if cleaned:
            lines = [
                line for line in cleaned.splitlines()
                if not line.strip().startswith(self.SCOPE_CONTEXT_PREFIX)
            ]
            cleaned = "\n".join(lines).strip()

        if scope == self.DEFAULT_SCOPE:
            return cleaned

        if cleaned:
            return f"{cleaned}\n{self.SCOPE_CONTEXT_PREFIX} {scope}"
        return f"{self.SCOPE_CONTEXT_PREFIX} {scope}"


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def _build_policy_registry() -> dict[type, DefaultScopePolicy]:
    from agent.state_models.atlassian_state import AtlassianAgentState  # noqa: PLC0415

    # initialize routing model with streaming disabled to avoid displaying internal routing decisions in the frontend
    router_model = ChatOpenAI(
        model="gpt-4.1-nano",
        streaming=False,
        disable_streaming=True,
        )

    return {
        AtlassianAgentState: AtlassianScopePolicy(router_model),
    }


_POLICY_REGISTRY: dict[type, DefaultScopePolicy] | None = None
_DEFAULT_POLICY = DefaultScopePolicy()


def get_policy_for_state(state_type: type) -> DefaultScopePolicy:
    global _POLICY_REGISTRY
    if _POLICY_REGISTRY is None:
        _POLICY_REGISTRY = _build_policy_registry()
    return _POLICY_REGISTRY.get(state_type, _DEFAULT_POLICY)