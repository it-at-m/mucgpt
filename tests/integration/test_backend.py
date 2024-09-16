from io import BytesIO
from unittest import mock
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import FreeText
import pytest
from fastapi.testclient import TestClient
from chat.chatresult import ChatResult
from brainstorm.BrainstormResult import BrainstormResult
from brainstorm.BrainstormRequest import BrainstormRequest
from summarize.SummarizeResult import SummarizeResult
from core.types.SumRequest import SumRequest
from core.types.ChatRequest import ChatRequest, ChatTurn
from core.types.Chunk import Chunk
from backend import backend

client = TestClient(backend)
headers = {
    "X-Ms-Token-Lhmsso-Id-Token": "dummy_id_token",
    "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
}


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO fix")
def test_index():
    response = client.get('/')
    assert response.status_code == 200
    assert "text/html" in response.headers
    

@pytest.mark.integration
def test_unknown_endpoint():
    response = client.post("/unknownendpoint")
    assert response.status_code == 404
    
@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.skip(reason="TODO fix")
async def test_favicon():
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.charset_encoding("image")
    assert response.charset_encoding("icon")
    

@pytest.mark.integration
def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200


@pytest.mark.integration
@pytest.mark.asyncio
async def test_sum_text(mocker):
    mock_result = SummarizeResult(answer= ["sum1", "sum2", "sum3"])
    mocker.patch("summarize.summarize.Summarize.summarize", mock.AsyncMock(return_value=mock_result))
    data = {
        "body": SumRequest(detaillevel="short", text="To be summarized", language="Deutsch", model="TEST_MODEL").model_dump_json()
    }
    response = client.post('/sum',  headers=headers,data=data)
    assert response.status_code == 200
    assert SummarizeResult.model_validate_json(response.content) == mock_result

@pytest.mark.integration
@pytest.mark.asyncio
async def test_sum_pdf(mocker):
    mock_result = SummarizeResult(answer= ["sum1", "sum2", "sum3"])
    mocker.patch("summarize.summarize.Summarize.summarize", mock.AsyncMock(return_value=mock_result))


    data = {
        "body": SumRequest(detaillevel="short", language="Deutsch", model="TEST_MODEL").model_dump_json()
    }

    tmp = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(219, 297)
    page = writer.pages[0] 
    writer.add_page(page) 
    # create text
    annotation =  FreeText(
        text="Hello World\nThis is the second line!",
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

    response = client.post('/sum', files={"file": ("file", tmp, "pdf")}, headers=headers,data=data)
    assert response.status_code == 200
    assert SummarizeResult.model_validate_json(response.content) == mock_result



@pytest.mark.integration
@pytest.mark.asyncio
async def test_brainstorm_exception(monkeypatch):
    monkeypatch.setattr(
        "brainstorm.brainstorm.Brainstorm.brainstorm",
        mock.Mock(side_effect=ZeroDivisionError("something bad happened")),
    )
    data = BrainstormRequest(topic="München", language="Deutsch", model="TEST_MODEL")
    response = client.post('/brainstorm', json=data.model_dump(),  headers=headers )
    assert response.status_code == 500
    assert "Exception in brainstorm: something bad happened" in str(response.content)
    

@pytest.mark.integration
@pytest.mark.asyncio
async def test_brainstorm(mocker):
    mock_result = BrainstormResult(answer= "result of brainstorming.")
    mocker.patch("brainstorm.brainstorm.Brainstorm.brainstorm", mock.AsyncMock(return_value=mock_result))
    data = BrainstormRequest(topic="München", language="Deutsch", model="TEST_MODEL")
    response = client.post('/brainstorm', json=data.model_dump(), headers=headers )
    assert response.status_code == 200
    assert BrainstormResult.model_validate_json(response.content) == mock_result

async def streaming_generator():
    yield Chunk(type="C", message= "Hello", order=0)

    yield Chunk(type="C", message= "World", order=1)

    yield Chunk(type="C", message= "!", order=2)

@pytest.mark.integration
@pytest.mark.asyncio
async def test_chatstream(mocker):
    mocker.patch("chat.chat.Chat.run_with_streaming", mock.AsyncMock(return_value=streaming_generator))
    data = ChatRequest(temperature=0.1, max_output_tokens=2400, system_message="", model="TEST_MODEL", history=[ChatTurn(user="hi")])
    response = client.post('/chat_stream', json=data.model_dump(), headers=headers)
    assert response.status_code == 200

@pytest.mark.integration
def test_chat(mocker):
    mock_result = ChatResult(content= "result of brainstorming.")
    mocker.patch("chat.chat.Chat.run_without_streaming",  mock.Mock(return_value=mock_result))
    data = ChatRequest(temperature=0.1, max_output_tokens=2400, system_message="", model="TEST_MODEL", history=[ChatTurn(user="hi")])
    response = client.post("/chat", headers=headers, json=data.model_dump())
    assert response.status_code == 200
    assert ChatResult.model_validate_json(response.content) == mock_result

@pytest.mark.integration
def test_config():
    response = client.get("/config", headers=headers)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skip(reason="TODO fix")
def test_statistics():
    response = client.get("/statistics", headers=headers)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skip(reason="TODO fix")
def test_counttokens():
    data = {
        "text": "Some text to count tokens",
        "model": {
            "llm_name": "model_name"
        }
    }
    response = client.post("/counttokens", headers=headers, json=data)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skip(reason="TODO fix")
def test_statistics_export():
    response = client.get("/statistics/export", headers=headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers
    assert response.headers == 'attachment; filename="statistics.csv"'