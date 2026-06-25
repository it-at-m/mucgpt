# 11 — Fake `BaseChatModel` test fixture (offline model)

**Milestone:** M4 — Offline test proof  ·  **Depends on:** 01  ·  **Size:** S

## Context
The model endpoint is down. The LLM is abstracted behind `ModelProvider`
(`app/config/model_provider.py`) and `init_app.ModelOptions.custom_model`
(`app/init_app.py:43`). We inject a fake `BaseChatModel` so the entire agent + persistence
flow runs with no network.

## Scope
**In:** reusable pytest fixtures providing a fake chat model and an `init_agent`/ModelProvider
override.
**Out:** the tests themselves (12–14).

## Implementation
1. `tests/conftest.py` (or extend `tests/integration/conftest.py`):
   - `fake_chat_model` fixture returning
     `langchain_core.language_models.fake_chat_models.GenericFakeChatModel(messages=iter([...]))`
     — scripted `AIMessage`s; it supports `.stream()`/`.astream()` so streaming paths work.
   - For tool-calling tests, script an `AIMessage` with `tool_calls=[...]` followed by a final
     answer.
2. Provide an override seam:
   - Either monkeypatch `ModelProvider.get_model` to return the fake, **or** override the
     `init_agent` dependency path. Prefer patching `ModelProvider.get_model` since
     `init_agent` calls it directly (`app/init_app.py:105`).
   - Add a `test_client_with_fake_model` fixture combining: `authenticate_user` override
     (existing), `get_db_session` override (in-memory sqlite, issue 12), and the fake model.

## Acceptance criteria
- A test can drive `/chat/completions` (stream + non-stream) end-to-end with the fake model,
  no network access.
- The fixture is reusable across issues 12–14.

## Notes
`GenericFakeChatModel` yields deterministic output → assertions are stable. If a test needs
multiple turns, re-create the fixture per call or pass a fresh message iterator.
