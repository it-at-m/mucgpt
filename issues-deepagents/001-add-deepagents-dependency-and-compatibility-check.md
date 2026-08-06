# 001 - Add deepagents Dependency And Compatibility Check

## Goal

Stage 1, step 1. Add `deepagents` as a pinned dependency and confirm it
resolves cleanly against the service's existing LangChain/LangGraph pins —
before any application code changes.

## Implementation

- Add `deepagents` to `mucgpt-core-service/pyproject.toml`, regenerate
  `uv.lock`.
- Record the resolved `langchain` / `langchain-core` / `langgraph` versions
  before and after; flag any forced upgrade or downgrade.
- Confirm Python `>=3.13` compatibility (matches the `agent/` codebase
  target).
- No application code changes in this issue — dependency only.

## Acceptance Criteria

- `uv sync --all-extras` succeeds with `deepagents` present.
- A short note (PR description or a `docs/` scratch file) lists the exact
  resolved versions and any pins that had to move.
- The existing test suite still passes unchanged (nothing imports
  `deepagents` yet).

## Tests

- None beyond the existing suite passing.

## Reviewer Notes

- Purely a dependency-and-record commit — reject any PR under this issue
  that also touches `app/agent/`.
