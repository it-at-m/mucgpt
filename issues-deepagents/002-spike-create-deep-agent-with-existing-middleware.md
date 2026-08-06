# 002 - Spike: create_deep_agent With Existing Middleware

## Goal

Stage 1, step 2. Prove `create_deep_agent` can be constructed with MUCGPT's
real middleware and tools before committing to the swap.

## Implementation

- Add a throwaway spike module under `mucgpt-core-service/app/agent/` — not
  wired into `init_app.py`, not imported by production code.
- Call `create_deep_agent(model, tools, system_prompt,
  middleware=[ContextMiddleware(...), ToolErrorMiddleware()],
  backend=StateBackend(), state_schema=...)` using the service's actual
  `ContextMiddleware`/`ToolErrorMiddleware` (`agent/middleware.py`) and a
  `DefaultAgentState`-shaped schema.
- Manually exercise: policy selection + tool filtering
  (`ContextMiddleware.wrap_model_call`), system-prompt swap
  (`modify_system_message`), data-source injection (`_inject_data_sources`),
  and Langfuse span annotation (`_annotate_span_with_policy_state`).
- Confirm `RequestContext` (the `context_schema` dataclass in
  `middleware.py`) can still be passed through and read back inside
  middleware under `create_deep_agent`'s context plumbing — or document
  exactly what has to change if not.

## Acceptance Criteria

- The spike runs one full turn end-to-end (model call + at least one tool
  call) with `ContextMiddleware` and `ToolErrorMiddleware` both firing.
- `RequestContext.assistant_id` is readable inside `ContextMiddleware`
  exactly as it is today.
- Findings (what worked as-is, what needed adaptation) feed into `003`'s
  compatibility note — don't duplicate reporting here.

## Tests

- None required beyond the spike script itself running successfully (it is
  deliberately throwaway, not production code).

## Reviewer Notes

- This issue produces no shippable change — its only output is confidence
  (or a documented blocker) for `005`–`007`. Delete the spike module once
  `003`'s findings note is written, or keep it under a clearly-marked
  `spikes/` path excluded from the app's import graph.
