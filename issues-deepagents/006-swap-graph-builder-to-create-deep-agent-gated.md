# 006 - Swap Graph Builder To create_deep_agent (Gated)

## Goal

Stage 2, step 2 — the actual harness swap, with every new capability
turned off.

## Implementation

- In `_ConfiguredLangChainAgentGraph` (`agent/react_agent.py`), replace the
  `create_agent(...)` call with `create_deep_agent(...)`, passing the same
  `model`, filtered `tools`, `system_prompt=DEFAULT_INSTRUCTIONS`,
  `middleware=[ContextMiddleware(...), ToolErrorMiddleware()]`, the
  resolved `state_schema` (from `005`), an ephemeral `StateBackend()` (per
  issue #1147's Design Choice 2 — no persistent backend, matches the
  per-request-rebuilt model), `context_schema=RequestContext`, and the
  bounded recursion limit from `004`.
- Do **not** pass `skills=`, `memory=`, or `subagents=` — leave them unset
  so `TodoListMiddleware`/`FilesystemMiddleware`/`SubAgentMiddleware` are
  the only always-on additions `create_deep_agent` itself makes, and their
  tools are never exposed to the model (matching Design Choice 3's
  "gate first"). Confirm concretely, with a test asserting the effective
  tool list, that end users see exactly today's tool set — not just that
  the code "should" hide them.
- Preserve `_prepare_run`'s per-request reconfiguration logic (model
  alternative binding, `extra_body`/`user` binding, dynamic tool selection,
  the cache-vs-rebuild-on-diff optimization) unchanged — only the
  constructor call inside it changes.
- Preserve the `.model` attribute and `.graph.astream`/`.graph.ainvoke`
  interface `MUCGPTReActAgent`/`MUCGPTAgentExecutor` depend on.

## Acceptance Criteria

- For a request with no deepagents-specific tools enabled, the model-facing
  tool list is byte-for-byte identical to today's (verified by a test, not
  just inspection).
- `RequestContext`/`assistant_id` propagation into `ContextMiddleware` still
  works (per `002`'s findings).
- `chat_router.py`/`tools_router.py` require zero changes for this issue —
  if they do, that's a signal this issue has grown beyond its scope.

## Tests

- A test that inspects the constructed agent's tool list for a plain
  default-tools request and asserts none of `write_todos`/`ls`/`read_file`/
  `write_file`/`edit_file`/`glob`/`grep`/`task` are present.

## Reviewer Notes

- This is the highest-risk single issue in the backlog — keep it exactly
  this small; resist folding in `007`–`011`'s concerns even if they're
  tempting to fix "while you're in there."
