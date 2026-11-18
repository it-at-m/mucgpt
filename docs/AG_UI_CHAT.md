# AG-UI chat contract (request side)

MUCGPT's chat endpoint streams AG-UI events and — since the adoption of the
native request format — accepts **both** of these request shapes on
`POST /api/backend/v1/chat/v2/completions`:

1. **Native AG-UI `RunAgentInput`** — the shape the `@ag-ui/client` `HttpAgent`
   builds natively (messages, `threadId`, `runId`, `protocolVersion`, state,
   context, tools, `forwardedProps`).
2. **Legacy MUCGPT chat envelope** — the pre-AG-UI `ChatCompletionRequest`
   JSON, still accepted during the transition.

Both are normalized onto the same internal model (`app/api/ag_ui_input.py`),
so every request-side gate — model capability, conversation ownership, image
binding, document selection — runs identically under both shapes.

## Shape discrimination

A JSON body is native AG-UI iff it carries a `protocolVersion` member. The
AG-UI spec obliges a consumer implementing 1.0 to declare the version it
speaks on the run input, so every AG-UI-native producer carries the member;
the legacy envelope never did.

## Version negotiation

In-band, per the spec's negotiation rules:

- The consumer (frontend) declares its version on
  `RunAgentInput.protocolVersion`.
- The producer (core service) declares its own version on
  `RUN_STARTED.protocolVersion` — its own, never an echo of the input's.
- A foreign major line is rejected with HTTP 400 before the run starts (no
  stream exists). A newer minor of the `1.*` line is served; unrecognised
  additions are stripped with a warning (additions are safe).
- The requested run echoes the input's `runId` on `RUN_STARTED` and
  `RUN_FINISHED`; a legacy request (which declares no `runId`) gets a fresh
  UUID per run.

## The `forwardedProps.mucgpt` namespace

Everything MUCGPT-specific rides in `forwardedProps` under the `mucgpt` key
(application-specific channel, passed through untouched by intermediaries).
The server strips unknown members of the namespace with a warning.

| Member           | Type               | Meaning                                                        |
| ---------------- | ------------------ | -------------------------------------------------------------- |
| `model`          | `string?`          | Model id; registry lookup happens server-side                  |
| `creativity`     | `"low"/"medium"/"high"?` | Mapped to a temperature through the model config          |
| `enabled_tools`  | `string[]?`        | Tool ids enabled for this run                                  |
| `assistant_id`   | `string?`          | Assistant configuration to use                                 |
| `persist`        | `boolean?`         | `false` runs statelessly (assistant previews); default `true`  |
| `data_sources`   | `ChatDataSource[]?`| Inline document payload (title/content/metadata)               |
| `canvas`         | `CanvasState?`     | Client-side canvas document state                              |
| `document_ids`   | `string[]?`        | Library documents to attach; **omitted** means "no document feature", an **explicitly empty list** means "detach all previously selected documents" |
| `language`       | `string?`          | The user's interface language; the agent responds in it by default, in the language the user writes in otherwise |

`messages` carries the conversation: the system prompt is the leading
`SystemMessage`, followed by alternating `UserMessage`/`AssistantMessage`
turns, each with a stable unique `id` (required by the schema).

## Multimodal input and the vision gate

`UserMessage.content` may carry multimodal content parts. The server resolves
them as follows:

- `TextPart`s are concatenated in order.
- An `ImagePart` with the inline **`data`** source arm is converted to an
  OpenAI-style `image_url` data-URL block and reaches the model — but only if
  the model's `model_info.supports_vision` is configured **`true`**.

**Deliberate deviation from the AG-UI spec.** The spec says a producer handed
an unusable part (an image to a non-vision model) *must not fail the run* —
it should skip the part and continue. MUCGPT rejects the run with a fail-closed
HTTP 400 instead. The rejection is a privacy-policy decision made before the
run starts, not a capability downgrade, and silently dropping user content
would be worse than refusing it. Documented here as a conscious exception.

- `url` sources are refused (fail closed): no authenticated image-content
  endpoint exists yet (image upload is tracked in #1398), and fetching
  arbitrary URLs server-side is an SSRF risk. When #1398 lands its content
  endpoint, this arm can be enabled without a contract change.
- `file` (provider-handle) sources are skipped with a warning, as the spec
  prescribes for a handle the producer cannot resolve.
- Other media types (audio/video/document parts) are refused with a clear 400
  until a mapping exists.

## Interrupt / resume groundwork

The endpoint already carries the AG-UI interrupt contract end to end, dormant
until a tool calls LangGraph's `interrupt()` (per-tool approval: #1093,
websearch confirmation: #1085):

- A run that ends in an interrupt emits `STATE_SNAPSHOT`, `MESSAGES_SNAPSHOT`
  and `RUN_FINISHED` with `outcome: { type: "interrupt", interrupts: [...] }`
  (bound by `toolCallId`, carrying the `responseSchema`).
- The next run's `resume[]` entries are mapped to a LangGraph
  `Command(resume=…)` keyed by interrupt id.

## Transition and deploy order

Core and frontend deploy **independently**; the release order for this change
is **core first, then frontend**:

- *Old frontend → new core*: works — the legacy envelope is still accepted,
  and the new `RUN_STARTED.protocolVersion` is additive for the old client.
- *New frontend → old core*: does **not** work for chat (the legacy envelope
  is not an older AG-UI version, so the client's protocol-version ceiling
  does not apply). The native request is rejected by the old parser. With
  `language` wired end-to-end, a mixed state additionally loses the language
  instruction (the old core ignores unknown `forwardedProps` — graceful
  degradation, not a failure).

### Retiring the legacy envelope

The legacy parse path is removed in a later hard cutover (same playbook as
the AG-UI-mandatory frontend change, PR #1446): delete the legacy branch of
`_parse_chat_request` and the envelope-only fields of the internal request
model (`temperature`, `max_tokens`, `stream`), keeping the internal fields
that serve both shapes. No frontend coordination is required once no released
frontend still sends the envelope.

## Config: `supports_vision`

`models[].model_info.supports_vision` (default `false`) declares whether the
model can consume image input. Only then are inline image parts bound;
otherwise the vision gate rejects the run before it starts.
