# 013 - Deferred: Enable Planning Todo List

## Status

**Not scheduled.** Scope only once an assistant genuinely needs multi-step
(10+ tool call) task tracking (e.g. a "deep research" assistant spanning
internal docs + Atlassian + web search) — not as infrastructure-in-advance.

## Goal

Turn on `TodoListMiddleware`'s `write_todos` tool for assistants doing
long, multi-source tool-calling chains, so the plan is an explicit,
recoverable artifact instead of implicit in the model's context.

## Implementation (when picked up)

- Enable per-assistant, same opt-in pattern as `012`.
- Decide UI surfacing (a visible plan/checklist vs. purely internal) before
  shipping.

## Acceptance Criteria

A long multi-tool-call assistant scenario shows stable, trackable progress;
assistants that don't opt in see no behavior change.

## Reviewer Notes

Do not enable this for the default/general-purpose assistant — it changes
the interaction model (visible planning) and should be a deliberate
per-assistant choice, not a global default.
