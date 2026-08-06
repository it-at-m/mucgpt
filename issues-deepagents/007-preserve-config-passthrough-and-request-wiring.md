# 007 - Preserve Config Passthrough And Request Wiring

## Goal

Stage 2, step 3. Confirm nothing outside `agent/` needed to change.

## Implementation

- Verify `init_app.py::init_agent` still constructs
  `ToolCollection.get_tools(user_info) → MUCGPTReActAgent →
  MUCGPTAgentExecutor` unchanged (the contract
  `tests/unit/test_init_app.py` already asserts).
- Verify `enabled_tools`, `llm`, `llm_temperature`, `llm_streaming`,
  `user_info`, `assistant_id`, and `data_sources` still flow through
  `MUCGPTAgentExecutor`'s `configurable` config (`agent_executor.py`) into
  `_prepare_run` and the constructed graph exactly as before.
- Confirm `chat_router.py` and `tools_router.py` are untouched — diff them
  against `main` at the end of this issue and expect zero lines changed.

## Acceptance Criteria

- `test_init_app.py` passes unchanged.
- A full request round-trip (default tools, no assistant) produces the same
  response shape as on `main`.

## Tests

- Existing `test_init_app.py` suite, plus one end-to-end request test
  comparing chunk-for-chunk output shape (not content, since that's
  model-dependent) against the pre-migration executor.

## Reviewer Notes

- If this issue turns up any required change outside `agent/`, stop and
  re-open `006` rather than patching it here — the whole point of the
  wrapper-adaptation design (issue #1147's Design Choice 1) is that this
  issue should find nothing to do.
