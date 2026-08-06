# Deep Agents Harness Migration Backlog

## Baseline

This backlog operationalizes GitHub issue **#1147** ("Switch from
langchain/langgraph to deepagents harness") and the auto-generated 4-phase
plan CodeRabbit posted on that issue. It restates that plan as a sequence of
small, independently reviewable/mergeable issues — the same shape as
`issues/` (the chat-persistence backlog) — and folds in three gaps found
reviewing #1147:

1. No bounded recursion/cost guardrail for deepagents' default
   (`create_deep_agent` compiles its graph with `recursion_limit=9_999`) —
   its own gate, `004`.
2. No explicit statement of which feature requests justify the migration —
   see **Motivation** below.
3. No sequencing note against the existing persistence backlog — see
   **Relationship to `issues/`** below.

## Guiding Principle

Same as `issues/000`: simplicity first, one small deployable change per
issue. The specific promise of *this* backlog is **byte-for-byte behavior
preservation** until Stage 4 is deliberately turned on. Nothing in Stages
1–3 should change what a user sees or how a request behaves — that is the
whole point of doing this "silently."

## Motivation

Written down plainly so it doesn't get lost: as of this writing, issue
#1147 itself names no specific missing capability — it's justified by
"saves capacity building things like skills ourselves" plus an
architectural preference for aligning with common agentic-chat patterns.
The one already-tracked, concrete feature request in this neighborhood is
**#1085** (User Confirmation for Websearch Queries) — but that's achievable
today via `HumanInTheLoopMiddleware` directly (already the same
`langchain.agents.middleware` import layer `agent/middleware.py` uses),
independent of this migration. See `016`.

**Action for whoever scopes Stage 4:** if there are specific feature
requests driving this decision, link them here. Stages 1–3 (the de-risked,
behavior-preserving swap) don't depend on knowing them. But which Stage 4
value features get turned on, for whom, and in what order, should be driven
by named requests — not by "deepagents has it, so let's use it."

## Relationship to `issues/` (chat persistence backlog)

Both backlogs eventually touch the same request path (`chat_router.py`,
`agent_executor.py`), but they are independent decisions:

- `issues/001`–`issues/007` (frontend `conversation_id`, DB models/repo/
  schemas, startup wiring) touch no agent code at all — fully independent,
  can proceed in parallel with this backlog at any time.
- `issues/008` (persist visible chat turns from `chat_router.py`) lands on
  the same request path this backlog's Stage 2–3 (`005`–`011`) modifies.

**Recommendation:** start this backlog's Stage 1 (`001`–`004`) immediately —
it touches no production code. Once Stage 1's compatibility findings note
exists, whichever of {this backlog's Stage 2, `issues/008`} is ready first
should land first; avoid having both mid-flight, unmerged, on the same
files at once, to keep review and conflict resolution simple. Do not let
this backlog's Stage 4 (value features) block or be blocked by anything in
`issues/` — they're unrelated concerns.

## Timeline

Stage 1 (`001`–`004`) should start as soon as possible — it's a dependency
add, a throwaway spike, and a findings note; no user-facing risk, no reason
to delay. Stages 2–3 should proceed as fast as each preceding stage's
acceptance criteria are actually met — do not compress Stage 3's regression
gate (`011`) to hit a deadline. That gate is what makes this migration
"silent"; skipping it defeats the purpose of staging it this way at all.
Stage 4 has no urgency and should stay gated until real, named use cases
justify each item individually.

## Non-Goals (this backlog)

- Do not enable `MemoryMiddleware` / cross-session memory (`016`).
- Do not change `chat_router.py` or `tools_router.py` at all until Stage 3
  confirms nothing needs to (`007`).
- Do not attach a LangGraph checkpointer as part of this migration —
  orthogonal, already tracked in `issues/016`.
- Do not turn on filesystem/planning/subagent tools for all users by
  default — Stage 4 items are per-assistant opt-ins, evaluated individually
  against a named use case.

## Reviewer Shape

**Stage 1 — De-risk**
1. `001-add-deepagents-dependency-and-compatibility-check.md`
2. `002-spike-create-deep-agent-with-existing-middleware.md`
3. `003-validate-streaming-and-state-schema-reducer-compatibility.md`
4. `004-bound-recursion-limit-and-cost-guardrails.md`

**Stage 2 — Swap harness behind the stable wrapper (gated off)**
5. `005-migrate-state-schemas-onto-deepagentstate.md`
6. `006-swap-graph-builder-to-create-deep-agent-gated.md`
7. `007-preserve-config-passthrough-and-request-wiring.md`

**Stage 3 — Preserve contracts + regression gate**
8. `008-reconcile-chunk-filtering-with-new-node-names.md`
9. `009-preserve-scope-policies-and-prompt-swapping.md`
10. `010-preserve-tool-streaming-contract.md`
11. `011-regression-test-suite-and-go-live-gate.md`

**Stage 4 — Deliberate opt-in value features (deferred, scope-on-demand)**
12. `012-deferred-enable-filesystem-context-offloading.md`
13. `013-deferred-enable-planning-todolist.md`
14. `014-deferred-evaluate-simplify-agent-as-subagent.md`
15. `015-deferred-skills-middleware-adoption.md`
16. `016-deferred-memory-middleware-excluded.md`
