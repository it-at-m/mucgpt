# 008 - Reconcile Chunk Filtering With New Node Names

## Goal

Stage 3, step 1. Stop any new internal harness event from leaking into the
user-visible SSE stream.

## Implementation

- Using `003`'s captured node-name list, update `_is_internal_chunk` and
  the `langgraph_node in {"call_model","assistant","model"}` allow-list in
  `agent_executor.py` so deepagents' internal nodes (summarization
  middleware, `PatchToolCallsMiddleware`, and — since `006` gates them off —
  confirmed-absent todo/filesystem/`task` nodes) are correctly classified.
- Preserve every existing `ChatCompletionChunk` shape: plain text in
  `delta.content`, tool state in `delta.tool_calls[0]`
  (`name`/`state`/`content`/`metadata`), and a terminal
  `finish_reason == "stop"`.
- Preserve `run_without_streaming`'s error contract: `finish_reason ==
  "error"`, non-null content, and it must never raise.

## Acceptance Criteria

- A request that would previously produce N visible chunks produces the
  same N chunks (same content, same order) post-migration.
- No chunk from a deepagents-internal node reaches the client in any test
  scenario, including one that deliberately forces a multi-tool-call turn.

## Tests

- Extend `tests/unit/test_agent_executor.py`'s chunk-shape tests with a
  case covering each new node name found in `003`.

## Reviewer Notes

- This is where a missed node name would silently leak internal agent
  chatter into the chat UI — treat any gap here as a blocker, not a
  follow-up.
