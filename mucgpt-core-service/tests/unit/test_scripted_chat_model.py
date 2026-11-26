import asyncio

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
from langchain_core.tools import tool
from tests.fakes.scripted_chat_model import (
    ScriptedChatModel,
    answer_from_tool,
    content_filtered,
    malformed_tool_call,
    message,
    raise_error,
    read_file,
    stream,
    text,
    wait_for,
)


def test_invoke_records_input_and_tool_binding() -> None:
    @tool
    def lookup(query: str) -> str:
        """Look up a value."""
        return query

    model = ScriptedChatModel(script=[read_file("/documents/a.txt", id="read-1")])
    assert model.bind_tools([lookup]) is model

    response = model.invoke([HumanMessage("Read the file")], temperature=0.2)

    assert response.tool_calls == [
        {
            "name": "read_file",
            "args": {"file_path": "/documents/a.txt"},
            "id": "read-1",
            "type": "tool_call",
        }
    ]
    assert model.recorded_inputs[0].messages == (HumanMessage("Read the file"),)
    assert model.recorded_inputs[0].settings == {"temperature": 0.2}
    assert model.bound_tool_schemas[0][0]["name"] == "lookup"
    model.assert_consumed()


@pytest.mark.asyncio
async def test_ainvoke_waits_for_event() -> None:
    event = asyncio.Event()
    model = ScriptedChatModel(script=[wait_for(event)])
    task = asyncio.create_task(model.ainvoke("wait"))

    await asyncio.sleep(0)
    assert not task.done()
    event.set()

    assert (await task).content == ""
    model.assert_consumed()


def test_stream_preserves_chunk_order() -> None:
    model = ScriptedChatModel(script=[stream("one", " two", " three")])

    chunks = list(model.stream("count"))

    assert [chunk.content for chunk in chunks] == ["one", " two", " three", ""]
    assert model.recorded_inputs[0].mode == "stream"
    model.assert_consumed()


def test_stream_step_invocation_preserves_tool_calls() -> None:
    tool_call_chunk = AIMessageChunk(
        content=[{"type": "text", "text": "Reading the file."}],
        tool_calls=[
            {
                "name": "read_file",
                "args": {"file_path": "/documents/a.txt"},
                "id": "read-1",
                "type": "tool_call",
            }
        ],
    )
    model = ScriptedChatModel(script=[stream(tool_call_chunk)])

    response = model.invoke("Read the file")

    assert response.content == [{"type": "text", "text": "Reading the file."}]
    assert response.tool_calls[0]["id"] == "read-1"
    model.assert_consumed()


def test_stream_of_message_preserves_tool_call() -> None:
    model = ScriptedChatModel(script=[read_file("/documents/a.txt", id="read-1")])

    chunks = list(model.stream("Read the file"))

    assert chunks[0].tool_calls[0]["id"] == "read-1"
    model.assert_consumed()


@pytest.mark.asyncio
async def test_astream_of_message_preserves_tool_call() -> None:
    model = ScriptedChatModel(script=[read_file("/documents/a.txt", id="read-1")])

    chunks = [chunk async for chunk in model.astream("Read the file")]

    assert chunks[0].tool_calls[0]["id"] == "read-1"
    model.assert_consumed()


def test_answer_from_tool_derives_content_from_the_tool_result() -> None:
    model = ScriptedChatModel(
        script=[
            read_file("/documents/a.txt", id="read-1"),
            answer_from_tool(tool_call_id="read-1", prefix="Answer: "),
        ]
    )
    first = model.invoke([HumanMessage("Read the file")])
    result = ToolMessage(
        content="@@ lines 1-1 of 1 @@\nMunicipal source", tool_call_id="read-1"
    )

    answer = model.invoke([HumanMessage("Read the file"), first, result])

    assert answer.content == "Answer: @@ lines 1-1 of 1 @@\nMunicipal source"
    model.assert_consumed()


def test_answer_from_tool_uses_the_latest_result() -> None:
    model = ScriptedChatModel(script=[answer_from_tool()])
    stale = ToolMessage(content="stale", tool_call_id="read-1")
    latest = ToolMessage(content="fresh", tool_call_id="read-2")

    assert model.invoke([stale, latest]).content == "fresh"
    model.assert_consumed()


@pytest.mark.asyncio
async def test_answer_from_tool_streams_the_derived_content() -> None:
    model = ScriptedChatModel(script=[answer_from_tool(tool_call_id="read-1")])
    result = ToolMessage(content="streamed body", tool_call_id="read-1")

    chunks = [chunk async for chunk in model.astream([result])]

    assert "".join(str(chunk.content) for chunk in chunks) == "streamed body"
    model.assert_consumed()


def test_answer_from_tool_rejects_a_missing_tool_result() -> None:
    model = ScriptedChatModel(script=[answer_from_tool(tool_call_id="read-9")])

    with pytest.raises(AssertionError, match="Missing tool result for read-9"):
        model.invoke([HumanMessage("Read the file")])


def test_invoke_records_supplied_stop() -> None:
    model = ScriptedChatModel(script=[text("answer")])

    model.invoke("question", stop=["STOP"])

    assert model.recorded_inputs[0].settings == {"stop": ["STOP"]}


@pytest.mark.asyncio
async def test_ainvoke_records_supplied_stop() -> None:
    model = ScriptedChatModel(script=[text("answer")])

    await model.ainvoke("question", stop=["STOP"])

    assert model.recorded_inputs[0].settings == {"stop": ["STOP"]}


def test_stream_records_supplied_stop() -> None:
    model = ScriptedChatModel(script=[stream("answer")])

    list(model.stream("question", stop=["STOP"]))

    assert model.recorded_inputs[0].settings == {"stop": ["STOP"]}


@pytest.mark.asyncio
async def test_astream_records_supplied_stop() -> None:
    model = ScriptedChatModel(script=[stream("answer")])

    _ = [chunk async for chunk in model.astream("question", stop=["STOP"])]

    assert model.recorded_inputs[0].settings == {"stop": ["STOP"]}


def test_stream_can_fail_after_partial_output() -> None:
    model = ScriptedChatModel(
        script=[stream("partial", then_raise=RuntimeError("stream stopped"))]
    )
    iterator = model.stream("count")

    assert next(iterator).content == "partial"
    with pytest.raises(RuntimeError, match="stream stopped"):
        next(iterator)
    model.assert_consumed()


@pytest.mark.asyncio
async def test_astream_preserves_chunk_order() -> None:
    model = ScriptedChatModel(script=[stream("one", " two")])

    chunks = [chunk async for chunk in model.astream("count")]

    assert [chunk.content for chunk in chunks] == ["one", " two", ""]
    model.assert_consumed()


def test_error_and_script_exhaustion_are_descriptive() -> None:
    model = ScriptedChatModel(script=[raise_error(ValueError("provider unavailable"))])

    with pytest.raises(ValueError, match="provider unavailable"):
        model.invoke("hello")
    with pytest.raises(AssertionError, match="after its script was consumed"):
        model.invoke("again")


def test_assert_consumed_reports_remaining_steps() -> None:
    model = ScriptedChatModel(script=[text("first"), text("second")])
    model.invoke("hello")

    with pytest.raises(AssertionError, match="1 unconsumed"):
        model.assert_consumed()


def test_content_filter_and_malformed_tool_call_helpers() -> None:
    model = ScriptedChatModel(
        script=[content_filtered("partial"), malformed_tool_call()]
    )

    assert (
        model.invoke("filtered").response_metadata["finish_reason"] == "content_filter"
    )
    invalid = model.invoke("bad tool call")
    assert invalid.invalid_tool_calls[0]["id"] == "malformed-1"
    model.assert_consumed()


@pytest.mark.asyncio
async def test_instances_do_not_share_script_state() -> None:
    first = ScriptedChatModel(script=[text("first")])
    second = ScriptedChatModel(script=[text("second")])

    responses = await asyncio.gather(first.ainvoke("a"), second.ainvoke("b"))

    assert [response.content for response in responses] == ["first", "second"]
    assert [call.messages[0].content for call in first.recorded_inputs] == ["a"]
    assert [call.messages[0].content for call in second.recorded_inputs] == ["b"]
    first.assert_consumed()
    second.assert_consumed()


def test_message_step_accepts_prebuilt_response() -> None:
    response = AIMessage(content="answer", response_metadata={"model_name": "scripted"})
    model = ScriptedChatModel(script=[message(response)])

    assert model.invoke("question").response_metadata["model_name"] == "scripted"
