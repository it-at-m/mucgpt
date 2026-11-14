"""Unit tests for agent scope policies and their message-text helpers."""

from types import SimpleNamespace

import pytest

from agent.tools.policies import (
    DefaultScopePolicy,
    _extract_message_text,
    _last_messages,
    _message_type,
    get_policy_for_state,
)


class TestHelpers:
    def test_last_messages_slices_tail(self):
        request = SimpleNamespace(
            messages=[f"msg-{i}" for i in range(6)]
        )

        assert _last_messages(request) == ["msg-2", "msg-3", "msg-4", "msg-5"]

    def test_last_messages_shorter_than_n(self):
        request = SimpleNamespace(messages=["only"])

        assert _last_messages(request) == ["only"]

    def test_last_messages_none(self):
        assert _last_messages(SimpleNamespace(messages=None)) == []

    @pytest.mark.parametrize(
        ("message", "expected"),
        [
            (SimpleNamespace(type="Human"), "human"),
            (SimpleNamespace(type="  TOOL  "), "tool"),
            (SimpleNamespace(type=None), "none"),  # str(None) — pinned behavior
            ("plain-string", ""),  # strings have no .type attribute
        ],
    )
    def test_message_type(self, message, expected):
        assert _message_type(message) == expected

    def test_extract_text_from_string_content(self):
        message = SimpleNamespace(content="  hello world  ")

        assert _extract_message_text(message) == "hello world"

    def test_extract_text_from_text_attribute(self):
        message = SimpleNamespace(content=None, text="fallback text")

        assert _extract_message_text(message) == "fallback text"

    def test_extract_text_from_list_content(self):
        message = SimpleNamespace(
            content=["  first  ", {"text": "second"}, {"ignored": "x"}, ""]
        )

        assert _extract_message_text(message) == "first\nsecond"

    def test_extract_text_empty_message(self):
        message = SimpleNamespace(content=None, text=None)

        assert _extract_message_text(message) == ""


class TestDefaultScopePolicy:
    def _request(self) -> SimpleNamespace:
        return SimpleNamespace(
            messages=["m1", "m2"], tools=["t1", "t2"], system_message="sys"
        )

    def test_infer_scope_returns_request_unchanged(self):
        request = self._request()
        policy = DefaultScopePolicy()

        assert policy.infer_scope(request) is request

    @pytest.mark.asyncio
    async def test_ainfer_scope_returns_request_unchanged(self):
        request = self._request()
        policy = DefaultScopePolicy()

        assert await policy.ainfer_scope(request) is request

    def test_select_tools_keeps_all_tools(self):
        policy = DefaultScopePolicy()

        assert policy.select_tools(self._request()) == ["t1", "t2"]

    def test_select_tools_empty(self):
        policy = DefaultScopePolicy()

        assert policy.select_tools(SimpleNamespace(tools=None)) == []

    def test_modify_system_message_returns_request_unchanged(self):
        request = self._request()
        policy = DefaultScopePolicy()

        assert policy.modify_system_message(request) is request

    @pytest.mark.asyncio
    async def test_amodify_system_message_returns_request_unchanged(self):
        request = self._request()
        policy = DefaultScopePolicy()

        assert await policy.amodify_system_message(request) is request


class TestPolicyRegistry:
    def test_unknown_state_type_falls_back_to_default_policy(self):
        class UnregisteredState:
            pass

        policy = get_policy_for_state(UnregisteredState)

        assert isinstance(policy, DefaultScopePolicy)

    def test_no_state_type_still_yields_default_policy(self):
        assert isinstance(get_policy_for_state(None), DefaultScopePolicy)
