# 012 - Deferred: Enable Filesystem Context Offloading

## Status

**Not scheduled.** Scope only once a concrete document-heavy use case is
confirmed (e.g. multi-document comparison/cross-referencing) — not merely
because the harness has this capability.

## Goal

Let the agent write intermediate drafts/retrieved-document content to
deepagents' virtual filesystem (`FilesystemMiddleware`, `StateBackend`)
instead of holding everything live in the resent message history —
addressing a scaling concern already visible today in
`_inject_data_sources` (`agent/middleware.py`), which stuffs full document
text into every turn's context.

## Implementation (when picked up)

- Enable `FilesystemMiddleware`'s tools (`ls`/`read_file`/`write_file`/
  `edit_file`/`glob`/`grep`) per-assistant (opt-in), not globally.
- Decide and document whether file-tool activity surfaces to the UI (reuse
  `ToolStreamChunk`, or keep internal) — do not ship silently either way
  without a decision recorded here.
- Confirm `008`'s node-filtering already accounts for whatever node names
  these tools introduce (it should, since `003` captured them even while
  gated off).

## Acceptance Criteria

A document-comparison scenario that would previously exceed a reasonable
context budget completes correctly with filesystem offloading enabled, and
is unaffected (no filesystem tools visible) for assistants that don't opt
in.

## Reviewer Notes

This is the strongest concrete case in Stage 4 — but still gate it behind
an actual assistant/use case, not a blanket default-on.
