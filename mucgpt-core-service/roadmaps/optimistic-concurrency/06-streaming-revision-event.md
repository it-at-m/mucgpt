# 06 — Surface revision on the streaming path

**Milestone:** M2 — API surface  ·  **Depends on:** 05  ·  **Size:** M  ·  **Action points:** 3

## Context
For streaming, HTTP headers are flushed before the assistant turn is appended, so
the *new* revision isn't known at header time. The conflict check, however, runs
**before** the stream starts (step 05 logic), so a stale turn is still rejected
with 409 up front. Only the post-turn revision needs a stream-time channel.

## Scope
**In:** pre-stream 409 + a final SSE event carrying the new revision. **Out:**
client parsing (08).

## Implementation (3 action points)
1. Pre-stream guard: run the same `replace_messages(..., expected_revision=...)`
   conflict check before returning the `StreamingResponse`, so a 409 is raised as
   a normal HTTP error (no stream opened) — identical to step 05.
2. Emit the revision at end-of-stream: in `sse_generator`'s `finally`, after the
   successful `append_message`, yield a final event such as
   `data: {"object": "conversation.revision", "conversation_revision": <int>}\n\n`
   before/with the existing `[DONE]`. Only emit when `not stream_failed`.
3. Document the event contract in the route docstring so the frontend (step 08)
   knows the exact shape and ordering relative to `[DONE]`.

## Acceptance criteria
- Stale revision on a streaming request → 409 before any chunk is sent.
- A successful stream ends with a revision event reflecting the post-turn value.
- Failed/aborted streams emit no revision event (consistent with PR #1067's
  no-persist-on-error rule).

## Notes
Reuse the existing `stream_failed` flag from PR #1067 so the revision event and
persistence stay gated by the same success condition.
