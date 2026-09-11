from contextlib import nullcontext
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from api.api_models import ChatCompletionMessage
from core.auth_models import AuthenticationResult
from core.llm_helpers import invoke_internal_generation


@pytest.mark.unit
@pytest.mark.asyncio
async def test_internal_generation_links_langfuse_prompt() -> None:
    model = MagicMock()
    model.bind.return_value = model
    model.ainvoke = AsyncMock(return_value=AIMessage(content="result"))
    prompt = object()

    with (
        patch("core.llm_helpers.ModelRegistry.get_model", return_value=model),
        patch(
            "core.llm_helpers.ModelRegistry.normalize_model_settings",
            side_effect=lambda _model, settings: settings,
        ),
        patch(
            "core.llm_helpers.LangfuseProvider.get_callback_handler",
            return_value=None,
        ),
        patch(
            "core.llm_helpers.propagate_attributes", return_value=nullcontext()
        ) as propagate,
    ):
        result = await invoke_internal_generation(
            model_name="model",
            temperature=0.0,
            messages=[ChatCompletionMessage(role="system", content="instruction")],
            user_info=AuthenticationResult(
                token="token", user_id="user", department="department"
            ),
            trace_tags=["test"],
            run_name="test-generation",
            langfuse_prompt=prompt,
        )

    assert result == "result"
    assert propagate.call_args.kwargs["prompt"] is prompt
