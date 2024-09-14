import pytest
import httpx
from fastapi.testclient import TestClient
from backend import backend

client = TestClient(backend)

@pytest.mark.asyncio
@pytest.mark.integration
def test_index():
    response = client.get('/')
    assert response.status_code == 200
    assert "text/html" in response.headers
    

@pytest.mark.asyncio
@pytest.mark.integration
def test_unknown_endpoint():
    response = client.post("/unknownendpoint")
    assert response.status_code == 404
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_favicon():
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.content_type.startswith("image")
    assert response.content_type.endswith("icon")
    

@pytest.mark.asyncio
@pytest.mark.integration
def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
def test_sum():
    headers = {
        "X-Ms-Token-Lhmsso-Id-Token": "dummy_id_token",
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    files = {
        "file": ("filename.txt", b"file content", "text/plain")
    }
    data = {
        "body": '{"text": "Some text to summarize", "detaillevel": 1, "language": "en", "model": "model_name"}'
    }
    response = client.post("/sum", headers=headers, files=files, data=data)
    assert response.status_code == 200
    # Add more assertions based on the expected response structure

@pytest.mark.asyncio
@pytest.mark.integration
def test_brainstorm():
    headers = {
        "X-Ms-Token-Lhmsso-Id-Token": "dummy_id_token",
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    data = {
        "topic": "Some topic",
        "language": "en",
        "model": "model_name"
    }
    response = client.post("/brainstorm", headers=headers, json=data)
    assert response.status_code == 200
        # Add more assertions based on the expected response structure

@pytest.mark.asyncio
@pytest.mark.integration
def test_chat_stream():
    headers = {
        "X-Ms-Token-Lhmsso-Id-Token": "dummy_id_token",
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    data = {
        "history": [],
        "temperature": 0.7,
        "max_output_tokens": 100,
        "system_message": "System message",
        "model": "model_name"
    }
    response = client.post("/chat_stream", headers=headers, json=data)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
def test_chat():
    headers = {
        "X-Ms-Token-Lhmsso-Id-Token": "dummy_id_token",
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    data = {
        "history": [],
        "temperature": 0.7,
        "max_output_tokens": 100,
        "system_message": "System message",
        "model": "model_name"
    }
    response = client.post("/chat", headers=headers, json=data)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
def test_config():
    headers = {
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    response = client.get("/config", headers=headers)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
def test_statistics():
    headers = {
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    response = client.get("/statistics", headers=headers)
    assert response.status_code == 200

@pytest.mark.asyncio
@pytest.mark.integration
def test_counttokens():
    headers = {
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
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
def test_statistics_export():
    headers = {
        "X-Ms-Token-Lhmsso-Access-Token": "dummy_access_token"
    }
    response = client.get("/statistics/export", headers=headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers
    assert response.headers == 'attachment; filename="statistics.csv"'