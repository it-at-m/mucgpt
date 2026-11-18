"""Tests for the native AG-UI run-input mapper (issue #1448, Path A)."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.ag_ui_input import (
    bind_media_parts,
    is_native_run_input,
    parse_run_agent_input,
    resume_payloads,
    supports_vision_for_model,
    to_chat_completion_request,
)
from config.model_provider import ModelRegistry
from config.settings import get_settings


def native_body(**overrides):
    """A minimal valid native AG-UI run input."""
    body = {
        "threadId": "conv-1",
        "runId": "run-42",
        "protocolVersion": "1.0",
        "messages": [
            {"id": "m0", "role": "system", "content": "You are MUCGPT"},
            {"id": "m1", "role": "user", "content": "Hallo"},
            {"id": "m2", "role": "assistant", "content": "Hi!"},
            {"id": "m3", "role": "user", "content": "Describe this"},
        ],
        "forwardedProps": {
            "mucgpt": {
                "model": "gpt-4o",
                "creativity": "medium",
                "enabled_tools": ["Vereinfachen"],
                "assistant_id": "assistant-1",
                "persist": False,
                "document_ids": ["d1"],
                "language": "German",
            }
        },
        "state": {},
        "tools": [],
        "context": [],
        "resume": [],
    }
    body.update(overrides)
    return body


class TestShapeDiscrimination:
    def test_native_body_declares_protocol_version(self):
        assert is_native_run_input(native_body())

    def test_legacy_envelope_is_not_native(self):
        assert not is_native_run_input({"conversation_id": "c", "messages": []})
        assert not is_native_run_input([1, 2, 3])
        assert not is_native_run_input(None)


class TestVersionNegotiation:
    def test_uninterpretable_version_rejected_with_400(self):
        with pytest.raises(HTTPException) as exc:
            parse_run_agent_input(native_body(protocolVersion="not-a-version"))
        assert exc.value.status_code == 400

    def test_foreign_major_line_rejected_with_400(self):
        with pytest.raises(HTTPException) as exc:
            parse_run_agent_input(native_body(protocolVersion="2.0"))
        assert exc.value.status_code == 400

    def test_newer_minor_of_own_line_is_served(self):
        run_input = parse_run_agent_input(native_body(protocolVersion="1.9"))
        assert run_input.thread_id == "conv-1"

    def test_malformed_input_rejected_with_422(self):
        body = native_body()
        del body["threadId"]
        with pytest.raises(HTTPException) as exc:
            parse_run_agent_input(body)
        assert exc.value.status_code == 422

    def test_unknown_top_level_member_is_stripped_not_fatal(self):
        run_input = parse_run_agent_input(native_body(unknownFutureField={"x": 1}))
        assert run_input.thread_id == "conv-1"


class TestChatRequestMapping:
    def test_forwarded_props_map_onto_internal_fields(self):
        request, pending_media = to_chat_completion_request(
            parse_run_agent_input(native_body())
        )
        assert request.conversation_id == "conv-1"
        assert request.model == "gpt-4o"
        assert request.creativity == "medium"
        assert request.enabled_tools == ["Vereinfachen"]
        assert request.assistant_id == "assistant-1"
        assert request.persist is False
        assert request.language == "German"
        assert request.document_ids == ["d1"]
        assert "document_ids" in request.model_fields_set
        assert pending_media == {}

    def test_omitted_document_ids_stay_omitted(self):
        body = native_body()
        del body["forwardedProps"]["mucgpt"]["document_ids"]
        request, _ = to_chat_completion_request(parse_run_agent_input(body))
        assert request.document_ids == []
        assert "document_ids" not in request.model_fields_set

    def test_unknown_mucgpt_members_are_stripped(self):
        body = native_body()
        body["forwardedProps"]["mucgpt"]["futureField"] = 42
        request, _ = to_chat_completion_request(parse_run_agent_input(body))
        assert not hasattr(request, "futureField")

    def test_invalid_forwarded_props_return_422_with_validation_details(self):
        body = native_body()
        body["forwardedProps"]["mucgpt"]["enabled_tools"] = "not-a-list"

        with pytest.raises(HTTPException) as exc:
            to_chat_completion_request(parse_run_agent_input(body))

        assert exc.value.status_code == 422
        assert exc.value.detail[0]["loc"] == ("enabled_tools",)

    def test_message_roles_map_and_media_flattens(self):
        body = native_body()
        body["messages"][-1] = {
            "id": "m3",
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe "},
                {"type": "text", "text": "this: "},
            ],
        }
        request, pending_media = to_chat_completion_request(parse_run_agent_input(body))
        assert [(m.role, m.content) for m in request.messages] == [
            ("system", "You are MUCGPT"),
            ("user", "Hallo"),
            ("assistant", "Hi!"),
            ("user", "Describe this: "),
        ]
        assert pending_media == {}

    def test_developer_instruction_maps_to_system_message(self):
        body = native_body()
        body["messages"] = [
            {"id": "d1", "role": "developer", "content": "Be concise."},
            {"id": "m1", "role": "user", "content": "Hallo"},
        ]

        request, _ = to_chat_completion_request(parse_run_agent_input(body))

        assert [(m.role, m.content) for m in request.messages] == [
            ("system", "Be concise."),
            ("user", "Hallo"),
        ]

    def test_activity_reasoning_and_tool_messages_are_stripped(self):
        body = native_body()
        body["messages"] = [
            {"id": "m1", "role": "user", "content": "Hallo"},
            {
                "id": "a1",
                "role": "activity",
                "activityType": "thinking",
                "content": {"description": "running"},
            },
            {"id": "r1", "role": "reasoning", "content": "secret thoughts"},
            {"id": "t1", "role": "tool", "toolCallId": "tc1", "content": "result"},
        ]
        request, _ = to_chat_completion_request(parse_run_agent_input(body))
        assert [(m.role, m.content) for m in request.messages] == [("user", "Hallo")]

    def test_contentless_assistant_history_is_stripped(self):
        body = native_body()
        body["messages"] = [
            {"id": "m1", "role": "user", "content": "Hallo"},
            {"id": "m2", "role": "assistant", "content": None},
            {"id": "m3", "role": "user", "content": "Continue"},
        ]

        request, _ = to_chat_completion_request(parse_run_agent_input(body))

        assert [(m.role, m.content) for m in request.messages] == [
            ("user", "Hallo"),
            ("user", "Continue"),
        ]

    def test_canvas_and_data_sources_map(self):
        body = native_body()
        body["forwardedProps"]["mucgpt"]["canvas"] = {
            "content": "# Doc",
            "truncated": False,
        }
        body["forwardedProps"]["mucgpt"]["data_sources"] = [
            {"title": "Handbook.pdf", "content": "text"}
        ]
        request, _ = to_chat_completion_request(parse_run_agent_input(body))
        assert request.canvas is not None
        assert request.canvas.content == "# Doc"
        assert request.canvas.truncated is False
        assert request.data_sources is not None
        assert request.data_sources[0].title == "Handbook.pdf"

    def test_null_canvas_and_data_sources_are_preserved(self):
        body = native_body()
        body["forwardedProps"]["mucgpt"]["canvas"] = None
        body["forwardedProps"]["mucgpt"]["data_sources"] = None

        request, _ = to_chat_completion_request(parse_run_agent_input(body))

        assert request.canvas is None
        assert request.data_sources is None
        assert {"canvas", "data_sources"} <= request.model_fields_set

    def test_malformed_canvas_rejected_with_422(self):
        body = native_body()
        body["forwardedProps"]["mucgpt"]["canvas"] = {"content": 42}
        with pytest.raises(HTTPException) as exc:
            to_chat_completion_request(parse_run_agent_input(body))
        assert exc.value.status_code == 422

    def test_malformed_data_sources_rejected_with_422(self):
        body = native_body()
        body["forwardedProps"]["mucgpt"]["data_sources"] = "not-a-list"
        with pytest.raises(HTTPException) as exc:
            to_chat_completion_request(parse_run_agent_input(body))
        assert exc.value.status_code == 422


class TestResumeMapping:
    def test_absent_resume_maps_to_none(self):
        assert resume_payloads(parse_run_agent_input(native_body())) is None

    def test_resume_entries_map_by_interrupt_id(self):
        body = native_body()
        body["resume"] = [
            {
                "interruptId": "i1",
                "status": "resolved",
                "payload": {"answer": "yes"},
            }
        ]
        assert resume_payloads(parse_run_agent_input(body)) == {"i1": {"answer": "yes"}}


class TestVisionGate:
    def _body_with_inline_image(self):
        body = native_body()
        body["messages"][-1] = {
            "id": "m3",
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this"},
                {
                    "type": "image",
                    "source": {
                        "type": "data",
                        "value": "QUJD",
                        "mime_type": "image/png",
                    },
                },
            ],
        }
        return body

    def test_empty_pending_media_binds_nothing(self):
        request, pending_media = to_chat_completion_request(
            parse_run_agent_input(native_body())
        )
        bind_media_parts(request, pending_media, supports_vision=False)
        assert all(m._media_blocks is None for m in request.messages)

    def test_fail_closed_on_non_vision_model(self):
        request, pending_media = to_chat_completion_request(
            parse_run_agent_input(self._body_with_inline_image())
        )
        with pytest.raises(HTTPException) as exc:
            bind_media_parts(request, pending_media, supports_vision=False)
        assert exc.value.status_code == 400
        assert "image input" in exc.value.detail

    def test_inline_image_binds_as_data_url_block(self):
        request, pending_media = to_chat_completion_request(
            parse_run_agent_input(self._body_with_inline_image())
        )
        bind_media_parts(request, pending_media, supports_vision=True)
        assert request.messages[3]._media_blocks == [
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,QUJD"}}
        ]

    def test_url_source_refused_fail_closed(self):
        body = native_body()
        body["messages"][-1] = {
            "id": "m3",
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this"},
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "value": "https://example.com/x.png",
                        "mime_type": "image/png",
                    },
                },
            ],
        }
        request, pending_media = to_chat_completion_request(parse_run_agent_input(body))
        with pytest.raises(HTTPException) as exc:
            bind_media_parts(request, pending_media, supports_vision=True)
        assert exc.value.status_code == 400
        assert "data" in exc.value.detail

    def test_file_source_skipped_with_warning(self):
        body = native_body()
        body["messages"][-1] = {
            "id": "m3",
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this"},
                {
                    "type": "image",
                    "source": {"type": "file", "value": "file-123"},
                },
            ],
        }
        request, pending_media = to_chat_completion_request(parse_run_agent_input(body))
        bind_media_parts(request, pending_media, supports_vision=True)
        assert request.messages[3]._media_blocks == []

    def test_inline_non_image_part_refused(self):
        body = native_body()
        body["messages"][-1] = {
            "id": "m3",
            "role": "user",
            "content": [
                {"type": "text", "text": "Transcribe this"},
                {
                    "type": "audio",
                    "source": {
                        "type": "data",
                        "value": "QUJD",
                        "mime_type": "audio/wav",
                    },
                },
            ],
        }
        request, pending_media = to_chat_completion_request(parse_run_agent_input(body))
        with pytest.raises(HTTPException) as exc:
            bind_media_parts(request, pending_media, supports_vision=True)
        assert exc.value.status_code == 400
        assert "AudioPart" in exc.value.detail


class TestSupportsVisionLookup:
    def test_configured_vision_model(self, monkeypatch):
        settings = get_settings()
        vision = settings.models[0].model_copy(deep=True)
        vision.id = "vision-model"
        vision.model_info.supports_vision = True
        plain = settings.models[0].model_copy(deep=True)
        plain.id = "text-only-model"
        plain.model_info.supports_vision = False
        monkeypatch.setattr(settings, "models", [vision, plain])
        monkeypatch.setattr(
            ModelRegistry,
            "get_model",
            lambda model_name: SimpleNamespace(model_name=model_name),
        )
        assert supports_vision_for_model("vision-model") is True
        assert supports_vision_for_model("text-only-model") is False

    def test_omitted_model_uses_registry_default(self, monkeypatch):
        settings = get_settings()
        vision = settings.models[0].model_copy(deep=True)
        vision.id = "vision-model"
        vision.model_info.supports_vision = True
        monkeypatch.setattr(settings, "models", [vision])
        monkeypatch.setattr(
            ModelRegistry,
            "get_model",
            lambda model_name: SimpleNamespace(model_name="vision-model"),
        )

        assert supports_vision_for_model(None) is True

    def test_unknown_model_is_non_vision(self):
        assert supports_vision_for_model("does-not-exist") is False
