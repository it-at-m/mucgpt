import asyncio

from httpx import Auth, Request
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.sessions import (
    SSEConnection,
    StreamableHttpConnection,
    create_session,
)
from langchain_mcp_adapters.tools import convert_mcp_tool_to_langchain_tool
from mcp import ClientSession
from mcp.types import Tool as MCPTool
from redis.asyncio import Redis
from redis.exceptions import LockError

from config.settings import MCPSourceConfig, MCPTransport, get_mcp_settings
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.logtools import getLogger

# Mirrors langchain_mcp_adapters.tools.MAX_ITERATIONS: a safety bound on paginated
# tools/list calls, not a real-world limit any MCP server is expected to hit.
_MAX_LIST_TOOLS_ITERATIONS = 1000


class McpLoader:
    _CACHE_PREFIX = "mcp_tools"
    _logger = getLogger(name="mucgpt-core-mcp-loader")
    _mcp_settings = get_mcp_settings()

    @staticmethod
    async def load_mcp_tools(
        user_info: AuthenticationResult,
        force_reload: bool | None = None,
    ) -> list[BaseTool]:
        """
        Load MCP tools for a given user and cache them.
        - Avoid caching partial results for full TTL after per-source failures.
        - Avoid returning [] during cache warm-up; wait briefly and, if needed, do an uncached load.
        - Support configurable forced reload (bypass cache reads) via config or per-call override.

        Only secret-free raw tool metadata (name/description/inputSchema) is ever cached in Redis.
        Auth/headers are rebuilt fresh from current config + user_info on every call, cache hit or
        not, so no credential ever gets persisted to the cache.

        Why this matters (this used to be a real vulnerability, not just a style choice):
        a LangChain `BaseTool` object is not inert metadata. Each tool's invocation closure
        holds a live reference to its full MCP connection dict — including any decrypted
        secret header values and a per-user bearer-auth object. Earlier versions of this
        loader cached those whole `BaseTool` objects via `RedisCache`, which serializes with
        `cloudpickle` (see core/cache.py). Unlike `json`, `cloudpickle` happily serializes
        arbitrary Python object graphs, closures and all — so credentials were being written
        into Redis without a single line of this file ever mentioning `secret_value`. The
        result: anyone with read access to that Redis instance could recover live, working
        credentials for up to `CACHE_TTL` (12h by default) after they were cached, well past
        the lifetime of the request that produced them. That's why every code path below
        keeps only secret-free raw `MCPTool` metadata in the cached payload, and always
        rebuilds the live connection/auth via `_build_connection` fresh from current config
        and `user_info` — never from anything that was ever persisted to Redis.
        """
        sources = McpLoader._mcp_settings.SOURCES
        McpLoader._logger.info(
            f"Configured MCP sources: {list(sources.keys()) if sources else []}"
        )

        if not sources:
            return []

        if user_info is None:
            raise ValueError("No user_info provided for load_mcp_tools")

        uid = user_info.user_id
        cache_key = f"{McpLoader._CACHE_PREFIX}:{uid}"

        # Decide effective force-reload behavior
        effective_force = (
            McpLoader._mcp_settings.FORCE_RELOAD
            if force_reload is None
            else force_reload
        )

        async def cached_or_none() -> list[BaseTool] | None:
            raw_dump: dict[str, list[MCPTool]] | None = await RedisCache.get_object(
                cache_key
            )
            if raw_dump is None:
                return None
            return McpLoader._wrap_raw_tools(raw_dump, user_info, sources)

        if not effective_force:
            cached = await cached_or_none()
            if cached is not None:
                return cached
        else:
            McpLoader._logger.info(
                "Force-reload enabled: bypassing MCP tools cache read"
            )

        # Helper to discover raw (secret-free) tool metadata from all sources
        async def fetch_all_tools() -> tuple[dict[str, list[MCPTool]], set[str]]:
            raw_by_source: dict[str, list[MCPTool]] = {}
            failed_sources: set[str] = set()

            for source_id, source_cfg in sources.items():
                McpLoader._logger.info(
                    f"Configuring MCP connection for source '{source_id}' "
                    f"with transport '{source_cfg.transport}' and url '{source_cfg.url}'"
                )

                con = McpLoader._build_connection(source_id, source_cfg, user_info)
                if con is None:
                    # Unsupported transport: this source can never yield tools, so
                    # count it as failed. Otherwise an all-unsupported config would
                    # leave raw_by_source and failed_sources both empty, which takes
                    # the "healthy load" branch below and caches an empty tool set
                    # for the full TTL instead of the short-TTL failure path.
                    failed_sources.add(source_id)
                    continue

                try:
                    async with create_session(con) as session:
                        await session.initialize()
                        raw_tools = await McpLoader._list_all_tools_for_session(session)

                    raw_by_source[source_id] = raw_tools
                    McpLoader._logger.info(
                        f"Retrieved MCP tools from '{source_id}': {len(raw_tools)}"
                    )
                except Exception as e:
                    McpLoader._logger.error(
                        f"Exception while fetching MCP tools from '{source_id}'",
                        exc_info=e,
                    )
                    failed_sources.add(source_id)

            return raw_by_source, failed_sources

        redis: Redis = await RedisCache.get_redis()
        lock_name = f"{cache_key}:lock"
        lock = redis.lock(name=lock_name, timeout=60, blocking_timeout=10)

        try:
            async with lock:
                McpLoader._logger.info("Acquired MCP tools lock")

                # Re-check cache after acquiring the lock unless forced reload
                if not effective_force:
                    cached = await cached_or_none()
                    if cached is not None:
                        return cached

                raw_by_source, failed_sources = await fetch_all_tools()
                total_tools = sum(len(v) for v in raw_by_source.values())

                if failed_sources:
                    # Do not cache partial/empty results for the full TTL.
                    if total_tools > 0:
                        short_ttl = 60  # Short TTL for partial success
                        McpLoader._logger.warning(
                            "Partial MCP tool load: failed sources=%s, caching partial set for %ss",
                            sorted(list(failed_sources)),
                            short_ttl,
                        )
                        await RedisCache.set_object(
                            key=cache_key,
                            obj=raw_by_source,
                            ttl=short_ttl,
                        )
                    else:
                        McpLoader._logger.warning(
                            "All MCP sources failed (%s); returning empty set without caching",
                            sorted(list(failed_sources)),
                        )
                    return McpLoader._wrap_raw_tools(raw_by_source, user_info, sources)

                # Healthy load: cache with full TTL
                await RedisCache.set_object(
                    key=cache_key,
                    obj=raw_by_source,
                    ttl=McpLoader._mcp_settings.CACHE_TTL,
                )
                return McpLoader._wrap_raw_tools(raw_by_source, user_info, sources)

        except LockError:
            # Another worker is warming the cache. Wait for a bounded deadline
            # and retry cache reads instead of returning [] immediately.
            McpLoader._logger.warning(
                "Could not acquire MCP tools lock; waiting up to 3s for cache warm-up"
            )
            for _ in range(15):  # ~3s total @ 200ms
                if not effective_force:
                    cached = await cached_or_none()
                    if cached is not None:
                        return cached
                await asyncio.sleep(0.2)

            # If still not available, perform an uncached load to avoid hiding tools.
            McpLoader._logger.warning(
                "Cache not ready after wait; performing uncached MCP tool load"
            )
            raw_by_source, _failed = await fetch_all_tools()
            return McpLoader._wrap_raw_tools(raw_by_source, user_info, sources)
        except Exception as e:
            McpLoader._logger.error(
                "Failed to acquire/use MCP tools lock",
                exc_info=e,
            )
            raise

    @staticmethod
    async def _list_all_tools_for_session(session: ClientSession) -> list[MCPTool]:
        """List all available tools from an MCP session, following pagination.

        Reimplemented locally (rather than importing langchain_mcp_adapters.tools's
        underscore-private equivalent) since langchain-mcp-adapters is pinned with an
        unbounded upper version (`>=0.2.2`) and private symbols aren't a stable contract.
        """
        current_cursor: str | None = None
        all_tools: list[MCPTool] = []
        iterations = 0

        while True:
            iterations += 1
            if iterations > _MAX_LIST_TOOLS_ITERATIONS:
                raise RuntimeError(
                    f"Reached max of {_MAX_LIST_TOOLS_ITERATIONS} iterations while listing tools."
                )

            list_tools_page_result = await session.list_tools(cursor=current_cursor)

            if list_tools_page_result.tools:
                all_tools.extend(list_tools_page_result.tools)

            if not list_tools_page_result.nextCursor:
                break

            current_cursor = list_tools_page_result.nextCursor

        return all_tools

    @staticmethod
    def _build_connection(
        source_id: str,
        source_cfg: MCPSourceConfig,
        user_info: AuthenticationResult,
    ) -> SSEConnection | StreamableHttpConnection | None:
        """Build a connection dict with live headers/auth for a single MCP source.

        This is the only place credentials are ever materialized. It must be called
        fresh for every use (discovery and tool invocation alike) and its result must
        never be cached, since it carries plaintext secrets (static headers, forwarded
        bearer tokens, auth overrides).
        """
        if source_cfg.transport is MCPTransport.SSE:
            con = SSEConnection(
                transport=MCPTransport.SSE.value,
                url=source_cfg.url,
            )
        elif source_cfg.transport is MCPTransport.STREAMABLE_HTTP:
            con = StreamableHttpConnection(
                transport=MCPTransport.STREAMABLE_HTTP.value,
                url=source_cfg.url,
            )
        else:
            McpLoader._logger.error(
                f"Unsupported transport protocol {source_cfg.transport} "
                f"for MCP source {source_id}"
            )
            return None

        con["headers"] = {}

        if source_cfg.headers:
            con["headers"].update(
                {
                    header_name: header_value.get_secret_value()
                    for header_name, header_value in source_cfg.headers.items()
                    if header_name.lower() != "authorization"
                }
            )

        if source_cfg.forward_token:
            auth_override = (
                source_cfg.forward_auth_override.get_secret_value()
                if source_cfg.forward_auth_override
                else None
            )

            con["auth"] = McpBearerAuthProvider(
                uid=user_info.user_id,
                token=user_info.token,
                auth_override=auth_override,
            )

        header_names = sorted(con["headers"].keys())
        McpLoader._logger.info(
            f"Header names configured for source '{source_id}': {header_names}"
        )

        return con

    @staticmethod
    def _apply_tool_customizations(
        wrapped_tool: BaseTool,
        source_id: str,
        source_config: MCPSourceConfig,
    ) -> None:
        """Apply description overrides and group metadata to a wrapped MCP tool in place."""
        # Attempt to load detailed tool descriptions for this mcp-source
        # this is optional and only used to enrich the tool metadata with a more detailed description, if available
        # The idea is that by customizing the mcp tool description files,
        # we can provide better, e.g. usecase specific, descriptions for the tools
        # We found that the descriptions provided by the MCP sources themselves are often not sufficient for good performance,
        # so this is a way to enrich them
        config_descriptions = source_config.descriptions or []
        custom_desc_entry = next(
            (d for d in config_descriptions if d.name == wrapped_tool.name),
            None,
        )
        custom_desc = custom_desc_entry.description if custom_desc_entry else None

        existing_metadata = dict(getattr(wrapped_tool, "metadata", {}) or {})
        old_description = existing_metadata.pop("description", None)

        metadata = {
            **existing_metadata,
            "mcp_source": source_id,
            "mcp_group": McpLoader._resolve_group(
                tool_name=wrapped_tool.name,
                source_config=source_config,
            ),
        }

        if custom_desc:
            metadata["description"] = custom_desc
            wrapped_tool.description = custom_desc
        elif old_description:
            metadata["description"] = old_description
            wrapped_tool.description = old_description

        wrapped_tool.metadata = metadata

    @staticmethod
    def _wrap_raw_tools(
        raw_by_source: dict[str, list[MCPTool]],
        user_info: AuthenticationResult,
        sources: dict[str, MCPSourceConfig],
    ) -> list[BaseTool]:
        """Turn cached-or-fresh raw tool metadata into live, invocable LangChain tools.

        Runs on every return path (cache hit, fresh fetch, lock-wait fallback) since the
        connection/auth attached here is always rebuilt live and never itself cached.
        """
        tools: list[BaseTool] = []

        for source_id, raw_tools in raw_by_source.items():
            source_cfg = sources.get(source_id)
            if source_cfg is None:
                McpLoader._logger.warning(
                    f"Cached MCP source '{source_id}' is no longer configured; skipping"
                )
                continue

            con = McpLoader._build_connection(source_id, source_cfg, user_info)
            if con is None:
                continue

            for raw_tool in raw_tools:
                try:
                    wrapped_tool = convert_mcp_tool_to_langchain_tool(
                        session=None,
                        tool=raw_tool,
                        connection=con,
                        server_name=source_id,
                    )
                    McpLoader._apply_tool_customizations(
                        wrapped_tool, source_id, source_cfg
                    )
                    tools.append(wrapped_tool)
                except Exception as e:
                    McpLoader._logger.error(
                        f"Failed to wrap cached MCP tool '{raw_tool.name}' from '{source_id}'",
                        exc_info=e,
                    )

        return tools

    @staticmethod
    def _resolve_group(tool_name: str, source_config: MCPSourceConfig) -> str | None:
        """Resolve the group for a tool: check tool_groups prefixes first, fall back to group."""
        tool_groups = getattr(source_config, "tool_groups", None)
        if tool_groups:
            lowered = tool_name.lower()
            for prefix, group in tool_groups.items():
                if lowered.startswith(prefix.lower()):
                    return group
        return getattr(source_config, "group", None)


class McpBearerAuthProvider(Auth):
    """
    Authentication scheme with updatable token per user for MCP requests.
    Supports explicit auth override and fallback token forwarding.
    """

    _tokens: dict[str, str] = {}

    def __init__(
        self,
        uid: str,
        token: str,
        auth_override: str | None = None,
    ) -> None:
        self._uid = uid
        self._auth_override = auth_override
        McpBearerAuthProvider._tokens[uid] = token

    @staticmethod
    def set_token(uid: str, token: str) -> None:
        McpBearerAuthProvider._tokens[uid] = token

    def auth_flow(self, request: Request):
        if self._auth_override:
            request.headers["Authorization"] = self._auth_override
            yield request
            return

        token = McpBearerAuthProvider._tokens.get(self._uid)
        if token is None:
            raise ValueError("Token is None but needed")

        normalized = token.strip()
        if token != normalized:
            McpLoader._logger.warning("Given authentication token was not normalized.")
        scheme, sep, _ = normalized.partition(" ")
        if sep and scheme.lower() in {"bearer", "basic"}:
            request.headers["Authorization"] = normalized
        else:
            request.headers["Authorization"] = f"Bearer {normalized}"

        yield request
