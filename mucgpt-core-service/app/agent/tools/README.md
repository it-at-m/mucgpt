# Tool handling

This folder builds the tools the agent can call and the metadata the frontend
uses to let a user pick which tools are enabled. There are two kinds of tools:

- **Local tools** - defined in this repo (`brainstorm.py`, `simplify.py`,
  `internet_search.py`). Adding one is a code change.
- **MCP tools** - loaded at runtime from configured MCP servers (`mcp.py`).
  Adding one is a config change (`config.yaml` / `MUCGPT_CORE_MCP__...`), not
  a code change.

## The pieces

**`spec.py` - `LocalTool`**
A small, frozen dataclass every local tool describes itself with: `id`
(matches the actual LangChain tool name), `factory` (builds the `BaseTool`),
`metadata` (per-language `{"name", "description"}` shown in the `/v1/tools`
tool picker), `needs_model` (does the factory need a bound LLM?),
`is_configured` (is this tool available in this deployment?), and `mcp_group`
(mirrors the `mcp_group` the built tool sets on its own `.metadata`, so it can
be reported without constructing the tool - see "State schema" below).

**`tools.py` - `LOCAL_TOOLS` and `ToolCollection`**
`LOCAL_TOOLS` is the list of all local tools (`[brainstorm.TOOL, simplify.TOOL,
internet_search.TOOL]`). `ToolCollection` is a thin, per-request object:
`ToolCollection(model).get_tools(user_info, enabled_tools=None)` builds every
configured local tool plus whatever `McpLoader` returns for this user, and
filters by `enabled_tools` if given. It's constructed fresh per request in
`init_app.py::init_agent`.

`_bind_model(tool_name)` binds a `MUCGPT_TOOL_NAME:<id>` tag onto the model
before handing it to a tool factory, purely so Langfuse traces show which
tool made a given LLM call (Brainstorming and Simplify call the LLM
themselves, independent of the main agent loop). See "Known gap" below for
why this is the *only* tag it adds.

**`tool_metadata.py` - `list_tool_metadata`**
Powers `GET /v1/tools`. For local tools this is pure data lookup -
`LocalTool.display(lang)` returns the metadata dict for a language, falling
back to `"english"` if that tool has no translation for the requested
language yet (this affects `InternetSearch` for French/Bairisch/Ukrainisch
today, which only has German/English text). For MCP tools it calls
`McpLoader.load_mcp_tools` (the exact same call `get_tools` makes) and reads
each tool's own `name`/`description`/`.metadata`. Nothing here constructs a
local tool instance or needs a model - the old version did, via a `DummyModel`
that faked being a `RunnableSerializable` purely so `make_brainstorm_tool`
etc. could be called just to read the resulting object's `.name`.

**`mcp.py` - `McpLoader`**
Unchanged by this cleanup. Connects to configured MCP servers per source,
tags each returned tool with `mcp_source`/`mcp_group` metadata, and caches
results in Redis with distributed-lock handling for concurrent requests. This
is genuinely load-bearing complexity (avoiding hammering MCP servers on every
chat request), not accidental complexity - don't try to simplify this away.

**State schema (`select_agent_state_schema`, `state_models/registry.py`)**
The agent picks a LangGraph state schema based on which `mcp_group` the
enabled tools share (e.g. all-Atlassian tools -> `AtlassianAgentState`). This
reads `tool.metadata["mcp_group"]` off the actual constructed `BaseTool`
objects at request time - untouched by this cleanup. `LocalTool.mcp_group` is
a separate, read-only mirror of the same value used only by `tool_metadata.py`
so it doesn't have to construct a tool just to report its group.

## Adding a tool

**Local tool:** create a module with a `TOOL = LocalTool(id=..., factory=...,
metadata={...})` and add it to `LOCAL_TOOLS` in `tools.py`. That's it - both
`get_tools()` (real agent tool list) and `list_tool_metadata()` (`/v1/tools`)
pick it up automatically.

**MCP tool:** add the server to MCP config. No code change.

## What used to be here, and why it's gone

- **`ToolCollection.add_instructions`** - injected a system message describing
  enabled tools. Deleted: it had zero callers anywhere in the service.
- **`tool_collection` field on `_ConfiguredLangChainAgentGraph`/
  `MUCGPTReActAgent`** (`react_agent.py`) - stored on `self`, never read
  again. Deleted; only the resolved `tools: list[BaseTool]` is threaded
  through.
- **`llm_user`/`assistant_id` params on `get_tools`/`_bind_model`** - meant to
  tag Brainstorming/Simplify's own LLM calls with the requesting user and
  assistant, same as the main model gets. Deleted because they were
  structurally unreachable: tools are constructed in `init_agent()`, but
  `llm_user` (a department-prefix derived from `user_info.department`) and
  `assistant_id` are only computed later, per-call, inside
  `AgentExecutor.run_with_streaming`/`run_without_streaming`
  (`agent_executor.py`) - by which point the tool objects (with their model
  baked into a closure) already exist. The only real call site
  (`init_app.py::init_agent`) never passed them, so this was already dead in
  practice.

  **Known gap / future work:** if Brainstorming/Simplify's own LLM calls
  should carry the user/assistant tag (today only the main reasoning model
  does, via `react_agent.py::_prepare_run`), the real fix is to compute
  `llm_user`/`assistant_id` earlier - in `chat_router.py`, before calling
  `init_agent()` - bind them once there, and pass the already-bound model
  into `ToolCollection`. That would also let you delete the duplicate
  `llm_user`/`_extract_department_prefix` derivation in `agent_executor.py`
  and the redundant per-turn re-bind in `react_agent.py::_prepare_run`. Not
  done here - it touches the request pipeline outside `agent/tools/`, and
  wasn't in scope for this pass.

- **Aside, unrelated to the above:** `policies.py`'s Atlassian scope router
  reads `tool.metadata.get("mcp_scope")` (`policies.py:_tool_scope`), but
  `McpLoader` only ever sets `metadata["mcp_group"]` - `mcp_scope` is never
  set anywhere, so that lookup always falls through to name-matching
  (`"jira" in tool_name`, etc). Separate subsystem, not touched here.
