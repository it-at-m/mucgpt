import openai
import pytest


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
                return openai.util.convert_to_openai_object(
                    {"choices": [{"delta": {"content": self.answer}}]}
                )
            else:
                raise StopAsyncIteration

    async def mock_acreate(*args, **kwargs):
        messages = kwargs["messages"]
        if (
            messages[-1]["content"]
            == "Generate search query for: What is the capital of France?"
        ):
            answer = "capital of France"
        else:
            answer = "The capital of France is Paris."
        if "stream" in kwargs and kwargs["stream"] is True:
            return AsyncChatCompletionIterator(answer)
        else:
            return openai.util.convert_to_openai_object(
                {"choices": [{"message": {"content": answer}}]}
            )

    monkeypatch.setattr(openai.ChatCompletion, "acreate", mock_acreate)
