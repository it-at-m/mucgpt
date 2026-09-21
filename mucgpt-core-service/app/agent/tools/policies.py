from __future__ import annotations

from typing import Any

from langchain.agents.middleware import ModelRequest

from core.logtools import getLogger

logger = getLogger(name="agent-policies")


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
        callbacks: list | None = None,
    ) -> ModelRequest:
        return request

    async def ainfer_scope(
        self,
        request: ModelRequest,
        callbacks: list | None = None,
    ) -> ModelRequest:
        return request

    def select_tools(
        self,
        request: ModelRequest,
    ) -> list[Any]:
        return list(request.tools or [])

    def modify_system_message(self, request: ModelRequest) -> ModelRequest:
        return request

    async def amodify_system_message(self, request: ModelRequest) -> ModelRequest:
        return request



# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def _build_policy_registry() -> dict[type, DefaultScopePolicy]:
    """Build the mapping from agent state types to scope policies.

    This registry is intentionally empty so that the policy system does not
    depend on any specific agent state or provider configuration. All
    states will currently use the `DefaultScopePolicy`.

    When we introduce specialized policies, they should be registered here
    without hard-coding a dependency on a single agent type.
    """

    # No custom policies registered yet; always fall back to DefaultScopePolicy.
    return {}


_POLICY_REGISTRY: dict[type, DefaultScopePolicy] | None = None
_DEFAULT_POLICY = DefaultScopePolicy()


def get_policy_for_state(state_type: type) -> DefaultScopePolicy:
    global _POLICY_REGISTRY
    if _POLICY_REGISTRY is None:
        _POLICY_REGISTRY = _build_policy_registry()

    policy = _POLICY_REGISTRY.get(state_type)
    if policy is None:
        logger.warning(
            "Policy decision: using %s because no policy is registered for state type '%s'.",
            _DEFAULT_POLICY.__class__.__name__,
            getattr(state_type, "__name__", str(state_type)),
        )
        return _DEFAULT_POLICY

    logger.info(
        "Policy decision: using %s for state type '%s'.",
        policy.__class__.__name__,
        getattr(state_type, "__name__", str(state_type)),
    )
    return policy
