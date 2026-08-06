# 014 - Deferred: Evaluate Simplify Agent As Subagent

## Status

**Not scheduled.** Optional, exploratory, isolated from the core migration.

## Goal

Evaluate whether `SimplifyAgent`'s hand-rolled generate/critique/refine
`StateGraph` (`agent/tools/simplify_agent.py`) is worth re-expressing as a
`SubAgentMiddleware` subagent, since its (name, description, prompt, tools)
shape maps onto that pattern, and it's already the second hand-built
instance of it (`brainstorm.py` is the first, simpler one).

## Implementation (when picked up)

- Prototype registering `SimplifyAgent`'s graph as a subagent, preserving
  its manual `ToolStreamChunk` emission (`STARTED`/`UPDATE`/`APPEND`/
  `ENDED`, section tags, `tool_name="Simplify"`) so the frontend needs no
  changes.
- If a third similar "mini-agent" tool is ever proposed, use that as the
  trigger to actually generalize the pattern — don't do it speculatively
  for just these two.

## Acceptance Criteria

`Simplify` behaves identically to users if this is implemented; otherwise,
no action is taken.

## Reviewer Notes

Explicitly non-blocking — do not let this delay `011`'s go-live gate or any
other Stage 4 issue.
