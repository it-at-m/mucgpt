# 003 - Validate Streaming And State-Schema Reducer Compatibility

## Goal

Stage 1, step 3. Confirm the wire-level streaming contract survives the
harness change, and pin down exactly what the state-schema migration
requires. This issue's findings note is the actual go/no-go gate for the
rest of the backlog.

## Implementation

- Using the `002` spike, verify `agent.astream(...,
  stream_mode=["messages","custom"])` still emits `AIMessageChunk`s on the
  `messages` channel, and that `ToolStreamChunk` JSON emitted via
  `get_stream_writer()` inside a tool still arrives on the `custom` channel
  unchanged.
- Confirm whether `create_deep_agent`'s default `DeepAgentState` (which uses
  a `DeltaChannel` reducer for `messages`, per deepagents'
  `ARCHITECTURE.md`) is compatible with a custom `state_schema` that keeps
  the standard `add_messages` reducer, or whether `DefaultAgentState`/
  `AtlassianAgentState` must adopt `DeltaChannel` too. Because MUCGPT never
  carries a checkpointer across turns (`checkpointer=None` everywhere), the
  concern is scoped to within-one-request tool-calling accumulation, not
  cross-turn checkpoint growth — confirm that scoping explicitly rather than
  assuming it.
- Capture every new `langgraph_node` name and subagent namespace the
  harness introduces internally (deepagents wires in its own
  `create_summarization_middleware`, `PatchToolCallsMiddleware`, etc. even
  with planning/filesystem/subagents gated off in `006`) that
  `agent_executor.py`'s `_is_internal_chunk` will need to recognize.
- Write the compatibility findings note (a `docs/` file or the PR
  description) summarizing every gap found in `002`/`003` and the chosen
  fix for each, before `005` starts.

## Acceptance Criteria

- Findings note exists and lists: the reducer-compatibility verdict, every
  new node name observed, and any breaking behavior found.
- No unresolved "unknown" items — if something is still unclear, that
  itself blocks Stage 2 from starting until resolved.

## Tests

- A spike-level assertion (not necessarily a permanent test) that streamed
  chunks match the expected shape for one representative multi-tool-call
  turn.

## Reviewer Notes

- This is the actual go/no-go gate for the whole backlog. If this issue
  turns up a fundamental incompatibility (e.g., `ToolStreamChunk` can't
  survive unmodified), stop and re-scope Stage 2 rather than pushing
  through on a deadline.
