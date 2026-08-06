# 009 - Preserve Scope Policies And Prompt Swapping

## Goal

Stage 3, step 2. Confirm the Atlassian scope-routing and data-source-
injection behavior is unaffected.

## Implementation

- Verify `ContextMiddleware` still resolves policies via
  `get_policy_for_state`, filters tools via `policy.select_tools`, swaps the
  system message via `modify_system_message` (skipped when `assistant_id`
  is set, per current behavior), and injects the guarded `<data-sources>`
  `HumanMessage` exactly once per turn.
- Confirm `AtlassianScopePolicy`'s structured-output router
  (`agent/tools/policies.py`) still runs, and that its intermediate LLM
  calls remain filtered from the user-visible stream (they should hit the
  same `_is_internal_chunk` path validated in `008`).
- Confirm `select_agent_state_schema` (`agent/tools/tools.py`) still drives
  schema/policy selection from tool metadata (`mcp_group`) unchanged.

## Acceptance Criteria

- An Atlassian-tools-enabled request produces the same tool-scoping/prompt
  behavior as on `main`.
- A data-sources request injects the guarded block exactly once, in the
  same position relative to the system message.

## Tests

- Existing policy/scope tests re-run against the new harness; add one
  covering data-source injection under `create_deep_agent`.

## Reviewer Notes

- Depends on `005`/`006` being merged; do not start before both are green.
