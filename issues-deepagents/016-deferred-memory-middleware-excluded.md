# 016 - Deferred: Memory Middleware Explicitly Excluded

## Status

**Explicitly excluded, not scheduled.** Mirrors the existing persistence
backlog's own non-goal.

## Goal

Record that `MemoryMiddleware` (cross-session memory via a `Store`) is
deliberately **not** enabled by this migration, matching `issues/`'s
explicit non-goal ("do not add cross-chat long-term memory").

## Why this needs its own file

`create_deep_agent` makes this a one-line opt-in (`memory=[...]`) once the
harness is in place — cheap enough that someone could turn it on later
without realizing it wasn't part of the original scope. It must not be
enabled without a separate, explicit product/privacy/compliance decision,
given MUCGPT operates behind LDAP/Keycloak SSO in a public-sector context
with its own data-retention expectations.

## When to pick this up

Only after that decision is made explicitly — not as a byproduct of any
other Stage 4 issue.

## Reviewer Notes

If any future PR passes `memory=` into `create_deep_agent`, treat it as a
scope change requiring the same sign-off this file describes, not a
routine enablement.
