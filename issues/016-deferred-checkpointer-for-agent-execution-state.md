# 016 - Deferred: Checkpointer For Agent Execution State

## Status

**Not scheduled as infrastructure-in-advance.** Do not implement this until a
concrete feature needs it — most likely the human-in-the-loop tool
confirmation work (it-at-m/mucgpt#1085, "User Confirmation for Websearch
Queries"). This file exists to record the *correct scope* for a checkpointer in
this system, so that when it is needed, it isn't rebuilt the way the closed PR
built it (checkpointer kept alive across a whole conversation, needing a
history-vs-checkpoint rebase step to avoid duplicating messages).

## Why a checkpointer is not redundant with the Stage 2 SQL persistence

The SQL read model (002-013) and a LangGraph checkpointer solve different
problems and neither substitutes for the other:

| | SQL read model | LangGraph checkpointer |
|---|---|---|
| Stores | The visible transcript (role, content) shown in the chat history UI | The graph's internal execution state: message-reducer state, tool-call/tool-result intermediates, whatever fields the dynamically-selected agent state schema adds, and any paused (`interrupt`) state |
| Answers | "What did the user see, across every past turn?" | "Where exactly is this one execution, right now?" |
| Lifetime | The whole conversation, indefinitely | A single run/turn, ideally short |

A durable transcript cannot tell a paused agent where it left off. LangChain's
`HumanInTheLoopMiddleware` (and `interrupt()`/`Command(resume=...)` generally)
**requires a checkpointer and a `thread_id`** — there is no way around this;
it's how LangGraph persists and resumes state across the pause. Without it, a
"confirm before running this tool" feature would have to replay the whole
agent loop from scratch after the user confirms, which is wasteful and can
produce a different model decision than the one the user actually approved.

## Why the closed PR's shape was wrong, and the corrected shape

The closed PR (and an earlier draft of this backlog) set `thread_id =
conversation_id` and expected the checkpoint to accumulate across every turn
of a whole conversation. Combined with the request-authoritative design (client
resends full visible history every turn), that duplicates messages via
LangGraph's `add_messages` reducer — which is exactly why that draft needed a
"history-to-checkpoint rebase" step to reconcile the two. That rebase step is
avoidable, not a necessary cost of using a checkpointer at all.

**Corrected scope, when this is built:**

1. **Scope the thread to a single turn, not the conversation.** Use a
   turn-local id (e.g. a fresh run id, or `f"{conversation_id}:{turn_seq}"`),
   not `conversation_id` reused across many separate turns. Each turn seeds a
   *fresh* checkpoint lineage from the request-authoritative history exactly as
   Stage 2 already does; the checkpoint's job ends when the turn ends.
2. **Use it only for what actually needs it**: `interrupt()`-based human
   confirmation (tool approval), and crash-recovery for a turn that's mid-flight
   (a long tool chain, a worker restart). Never as a substitute for cross-turn
   memory — that stays SQL's job, unchanged.
3. **No rebase helper needed.** Because a turn-scoped checkpoint never has to
   reconcile against previously-resent history (it never outlives one turn),
   the entire class of bug the old rebase step existed to fix doesn't occur.
4. **Short TTL / cleanup.** Expire or delete a turn's checkpoint once its
   assistant message is durably written to SQL (with maybe a short grace window
   for crash-recovery retries). No unbounded per-conversation checkpoint
   growth.
5. **Config shape can be reused** from the closed PR's design —
   `CHECKPOINTER.backend: memory|sqlite|postgres` — since that part wasn't the
   problem. `memory` for tests, `postgres` in prod alongside the existing SQL
   DB.
6. **State-schema compatibility falls out naturally**: the dynamic agent state
   schema (`select_agent_state_schema`) is already chosen once per request
   based on that request's enabled tools, and a turn-scoped thread only ever
   runs with one schema — no cross-turn schema drift to handle.

## When to pick this up

When implementation actually starts on #1085 or a similar
pause-for-confirmation feature. At that point, split it the same way the rest
of this backlog is split: a checkpointer-provider issue (infra only), then a
"wire it into the specific HITL-enabled graph, turn-scoped" issue — not a
blanket "attach to every chat graph" change.
