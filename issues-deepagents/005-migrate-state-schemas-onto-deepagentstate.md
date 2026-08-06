# 005 - Migrate State Schemas Onto DeepAgentState

## Goal

Stage 2, step 1. Make `DefaultAgentState`/`AtlassianAgentState` compatible
with the harness's `state_schema` requirement, per `003`'s findings.

## Implementation

- Update `agent/state_models/default_state.py` and
  `agent/state_models/atlassian_state.py` per whichever reducer-
  compatibility path `003` settled on (either adopt `DeepAgentState`'s
  `messages` reducer, or confirm the existing one is compatible as-is — do
  not guess; `003` must have already answered this).
- Preserve every existing custom field (e.g. `data_sources`,
  `current_scope`, `locked_scope`, `scope_confidence`) unchanged in name and
  type.
- Keep `agent/state_models/registry.py`'s group→schema mapping intact so
  `select_agent_state_schema` (`agent/tools/tools.py`) continues to resolve
  `AtlassianAgentState`/`DefaultAgentState` exactly as today.
- Confirm the migrated schemas still work as `ContextMiddleware`'s policy
  key (`get_policy_for_state`, `agent/tools/policies.py`) — a hard
  dependency, not just a state-shape concern.

## Acceptance Criteria

- `select_agent_state_schema` returns the same schema for the same tool
  sets as before this change.
- `get_policy_for_state` resolves the correct policy for both schemas,
  unchanged.
- No new required field is introduced that breaks constructing state from
  the plain `{"messages": [...]}` input `_ConfiguredLangChainAgentGraph.
  _prepare_run` passes in today.

## Tests

- Unit tests asserting schema resolution is unchanged for both the default
  tool set and an Atlassian-tool-enabled set.

## Reviewer Notes

- Schema-only — this commit should not touch `react_agent.py` yet. Mirrors
  the discipline `issues/003` used for the persistence models.
