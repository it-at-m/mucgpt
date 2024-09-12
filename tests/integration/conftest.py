import os

import openai
import pytest
import pytest_asyncio

import app


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
    monkeypatch.setenv("MUCGPT_CONFIG", os.path.dirname(os.path.realpath(__file__))+"/test_config.json")
    monkeypatch.setenv("MUCGPT_BASE_CONFIG", os.path.dirname(os.path.realpath(__file__))+"/base.json")

    quart_app = app.create_app()
    async with quart_app.test_app() as test_app:
        quart_app.config.update({"TESTING": True})

        yield test_app.test_client()

