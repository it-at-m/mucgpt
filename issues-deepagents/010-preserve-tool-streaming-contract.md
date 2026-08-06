# 010 - Preserve Tool Streaming Contract

## Goal

Stage 3, step 3. Keep the `ToolStreamChunk` protocol working for every
local tool.

## Implementation

- Verify `get_stream_writer()` inside `agent/tools/brainstorm.py`,
  `agent/tools/simplify.py`/`simplify_agent.py`, and
  `agent/tools/internet_search.py` still resolves correctly within a
  `create_deep_agent` run (deepagents runs tools inside the same LangGraph
  tool-execution machinery, so this should be a no-op — but verify, don't
  assume).
- Confirm every `ToolStreamChunk` state (`STARTED`/`UPDATE`/`APPEND`/
  `ENDED`, and any others defined in `agent/tools/tool_chunk.py`) still
  reaches the frontend's tool-stream handling unchanged.
- Confirm MCP tools loaded via `agent/tools/mcp.py` still attach and stream
  correctly through the new harness.

## Acceptance Criteria

- `SimplifyAgent`'s generate/critique/refine streaming sections render
  identically pre/post migration.
- `brainstorm.py`'s streamed markdown mind-map output is unaffected.
- At least one MCP tool streams correctly end-to-end under the new harness.

## Tests

- Re-run/extend existing tool-streaming tests for `simplify_agent`,
  `brainstorm`, and one MCP tool.

## Reviewer Notes

- This is the other place a subtle breakage would be very visible to users
  (broken tool-progress indicators) but easy to miss in a diff-only code
  review — actually run the chat UI against this change (see `011`).
