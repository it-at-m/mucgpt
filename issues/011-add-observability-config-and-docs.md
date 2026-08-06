# 011 - Add Observability, Config Examples, and Docs

## Goal

Stage 2, step 10. Make the Stage 2 persistence model understandable and
operable.

## Implementation

- Update core config examples with the `DB` block.
- Add concise documentation explaining:
  - the SQL conversation read model and what it stores.
  - that it runs beside the existing IndexedDB-primary frontend, not in place
    of it, until Stage 3.
  - that there is no checkpointer and no locking in this stage, and why (see
    015 and 016 for the deferred reasoning).
  - current non-goal of cross-chat memory.
- Add structured logs around:
  - conversation auto-create.
  - backend sync failure on the frontend where appropriate.

## Acceptance Criteria

- A developer can run locally with default SQLite settings.
- A deployer can configure Postgres for the SQL read model.
- Docs do not describe this as long-term memory, and do not imply a
  checkpointer or execution-state resume exists yet.

## Tests

- Config example remains parseable if the project has config validation
  tests.
- Existing settings tests pass.

## Reviewer Notes

- Keep docs focused on this backlog's actual Stage 2 scope.
- Do not reference the closed feature branch as the source of truth for
  current behavior — link it only as prior art/history if useful.
