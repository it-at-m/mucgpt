from collections import namedtuple
from unittest import mock

import openai
import pytest
import pytest_asyncio

import app

MockToken = namedtuple("MockToken", ["token", "expires_on"])


class MockAzureCredential:
    async def get_token(self, uri):
        return MockToken("mock_token", 9999999999)



@pytest.fixture
def mock_openai_chatcompletion(monkeypatch):
    class AsyncChatCompletionIterator:
        def __init__(self, answer):
            self.num = 1
            self.answer = answer

        def __aiter__(self):
            return self

        async def __anext__(self):
            if self.num == 1:
                self.num = 0
                return openai.util.convert_to_openai_object({"choices": [{"delta": {"content": self.answer}}]})
            else:
                raise StopAsyncIteration

    async def mock_acreate(*args, **kwargs):
        messages = kwargs["messages"]
        if messages[-1]["content"] == "Generate search query for: What is the capital of France?":
            answer = "capital of France"
        else:
            answer = "The capital of France is Paris."
        if "stream" in kwargs and kwargs["stream"] is True:
            return AsyncChatCompletionIterator(answer)
        else:
            return openai.util.convert_to_openai_object({"choices": [{"message": {"content": answer}}]})

    monkeypatch.setattr(openai.ChatCompletion, "acreate", mock_acreate)



@pytest_asyncio.fixture
async def client(monkeypatch, mock_openai_chatcompletion):
    monkeypatch.setenv("AZURE_OPENAI_SERVICE", "test-openai-service")
    monkeypatch.setenv("AZURE_OPENAI_CHATGPT_DEPLOYMENT", "test-chatgpt")
    monkeypatch.setenv("AZURE_OPENAI_CHATGPT_MODEL", "gpt-35-turbo")
    monkeypatch.setenv("AZURE_OPENAI_EMB_DEPLOYMENT", "test-ada")
    monkeypatch.setenv("SSO_ISSUER", "testissuer.de")
    monkeypatch.setenv("CONFIG_NAME", "test")
    monkeypatch.setenv("DB_HOST", "not used")
    monkeypatch.setenv("DB_NAME", "not used")
    monkeypatch.setenv("DB_PASSWORD", "not used")
    monkeypatch.setenv("DB_USER", "not used")


    with mock.patch("init_app.DefaultAzureCredential") as mock_default_azure_credential:
        mock_default_azure_credential.return_value = MockAzureCredential()
        quart_app = app.create_app()

        async with quart_app.test_app() as test_app:
            quart_app.config.update({"TESTING": True})

            yield test_app.test_client()

