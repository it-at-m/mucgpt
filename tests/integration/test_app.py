from unittest import mock
import pytest
import quart.testing.app
from httpx import Request, Response
from openai import BadRequestError
import app
from brainstorm.brainstormresult import BrainstormResult
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
async def test_missing_env_vars():
    quart_app = app.create_app()

    with pytest.raises(quart.testing.app.LifespanError) as exc_info:
        async with quart_app.test_app() as test_app:
            test_app.test_client()
        assert str(exc_info.value) == "Lifespan failure in startup. ''AZURE_OPENAI_EMB_DEPLOYMENT''"

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
        
    }
    response = await client.post('/brainstorm', json=data)
    assert response.status_code == 500
    result = await response.get_json()
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
        "text": "Hi",
    }
    response = await client.post('/sum', data={"body": data})
    assert response.status_code == 200
    result = await response.get_json()
    assert result == mock_result