import json
from io import BytesIO
from unittest import mock

import PyPDF2
import pytest
from httpx import Request, Response
from openai import BadRequestError
from quart.datastructures import FileStorage

from brainstorm.BrainstormResult import BrainstormResult
from core.types.Chunk import Chunk
from summarize.summarizeresult import SummarizeResult


def fake_response(http_code):
    return Response(http_code, request=Request(method="get", url="https://foo.bar/"))


# See https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/content-filter
filtered_response = BadRequestError(
    message="The response was filtered",
    body={
        "message": "The response was filtered",
        "type": None,
        "param": "prompt",
        "code": "content_filter",
        "status": 400,
    },
    response=Response(
        400, request=Request(method="get", url="https://foo.bar/"), json={"error": {"code": "content_filter"}}
    ),
)

contextlength_response = BadRequestError(
    message="This model's maximum context length is 4096 tokens. However, your messages resulted in 5069 tokens. Please reduce the length of the messages.",
    body={
        "message": "This model's maximum context length is 4096 tokens. However, your messages resulted in 5069 tokens. Please reduce the length of the messages.",
        "code": "context_length_exceeded",
        "status": 400,
    },
    response=Response(400, request=Request(method="get", url="https://foo.bar/"), json={"error": {"code": "429"}}),
)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_index(client):
    response = await client.get('/')
    assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unknown_endpoint(client):
    response = await client.post("/unknownendpoint")
    assert response.status_code == 404
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_favicon(client):
    response = await client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.content_type.startswith("image")
    assert response.content_type.endswith("icon")
    

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skip(reason="TODO implement better error handling.")
async def test_brainstorm_exception(client, monkeypatch,caplog):
    monkeypatch.setattr(
        "brainstorm.brainstorm.Brainstorm.brainstorm",
        mock.Mock(side_effect=ZeroDivisionError("something bad happened")),
    )
    data = {
        "topic": "München",
        "language": "Deutsch",
        "model": "TEST_MODEL",
    }
    response = await client.post('/brainstorm', json=data)
    assert response.status_code == 500
    await response.get_json()
    assert "Exception in /error: something bad happened" in caplog.text
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_brainstorm_must_be_json(client):
    response = await client.post('/brainstorm')
    assert response.status_code == 415
    result = await response.get_json()
    assert result["error"] == "request must be json"
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_brainstorm(client, mocker):
    mock_result = BrainstormResult(answer= "result of brainstorming.")
    mocker.patch("brainstorm.brainstorm.Brainstorm.brainstorm", mock.AsyncMock(return_value=mock_result))
    data = {
        "topic": "München",
        "language": "Deutsch",
        "model": "TEST_MODEL",
    }
    response = await client.post('/brainstorm', json=data)
    assert response.status_code == 200
    result = await response.get_json()
    assert result == mock_result
    
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_sum_text(client, mocker):
    mock_result = SummarizeResult(answer= ["sum1", "sum2", "sum3"])
    mocker.patch("summarize.summarize.Summarize.summarize", mock.AsyncMock(return_value=mock_result))
    data = {
        "detaillevel": "short",
        "text": "To be summarized",
        "language": "Deutsch",
        "model": "TEST_MODEL",
    }
    response = await client.post('/sum',  form={"body": json.dumps(data)})
    assert response.status_code == 200
    result = await response.get_json()
    assert result == mock_result

@pytest.mark.asyncio
@pytest.mark.integration
async def test_sum_pdf(client, mocker):
    mock_result = SummarizeResult(answer= ["sum1", "sum2", "sum3"])
    mocker.patch("summarize.summarize.Summarize.summarize", mock.AsyncMock(return_value=mock_result))

    data = {
        "detaillevel": "short",
        "language": "Deutsch",
        "model": "TEST_MODEL"
    }

    tmp = BytesIO()
    writer = PyPDF2.PdfWriter()
    writer.add_blank_page(219, 297)
    page = writer.pages[0] 
    writer.add_page(page) 
    # create text
    annotation = PyPDF2.generic.AnnotationBuilder.free_text(
        "Hello World\nThis is the second line!",
        rect=(50, 550, 200, 650),
        font="Arial",
        bold=True,
        italic=True,
        font_size="20pt",
        font_color="00ff00",
        border_color="0000ff",
        background_color="cdcdcd",
    )
    writer.add_annotation(page_number=0, annotation=annotation)
    writer.write(tmp)
    tmp.seek(0)

    response = await client.post('/sum',  form={"body": json.dumps(data)}, files={"file": FileStorage(tmp, filename="file")})
    assert response.status_code == 200
    result = await response.get_json()
    assert result == mock_result

@pytest.mark.asyncio
@pytest.mark.integration
async def test_chat_stream_must_be_json(client):
    response = await client.post('/chat_stream')
    assert response.status_code == 415
    result = await response.get_json()
    assert result["error"] == "request must be json"

async def streaming_generator():
    yield Chunk(type="C", message= "Hello", order=0)

    yield Chunk(type="C", message= "World", order=1)

    yield Chunk(type="C", message= "!", order=2)

@pytest.mark.asyncio
@pytest.mark.integration
async def test_chatstream(client, mocker):
    mocker.patch("chat.chat.Chat.run_without_streaming", mock.AsyncMock(return_value=streaming_generator))
    data = {
        "temperature": 0.1,
        "max_output_tokens": 2400,
        "system_message": "",
        "model": "TEST_MODEL",
        "history": [{"user": "hi"}]
        
    }
    response = await client.post('/chat_stream', json=data)
    assert response.status_code == 200