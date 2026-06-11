import asyncio

from httpx import Auth, Request
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.sessions import SSEConnection, StreamableHttpConnection
from redis.asyncio import Redis
from redis.exceptions import LockError

from config.settings import MCPSourceConfig, MCPTransport, get_mcp_settings
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.logtools import getLogger


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
            McpLoader._mcp_settings.FORCE_RELOAD if force_reload is None else force_reload
        )

        if not effective_force:
            tools_dump: list[BaseTool] | None = await RedisCache.get_object(cache_key)
            if tools_dump is not None:
                return tools_dump
        else:
            McpLoader._logger.info("Force-reload enabled: bypassing MCP tools cache read")


        # Helper to build connections and fetch tools from all sources
        async def fetch_all_tools() -> tuple[list[BaseTool], set[str]]:
            mcp_connections = {}

            for source_id, source_cfg in sources.items():
                McpLoader._logger.info(
                    f"Configuring MCP connection for source '{source_id}' "
                    f"with transport '{source_cfg.transport}' and url '{source_cfg.url}'"
                )

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
                    continue

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

                mcp_connections[source_id] = con

            McpLoader._logger.info("Loading MCP tools")
            mcp_client = MultiServerMCPClient(connections=mcp_connections)

            tools: list[BaseTool] = []
            failed_sources: set[str] = set()

            for source_id in mcp_connections.keys():
                try:
                    source_tools = await mcp_client.get_tools(server_name=source_id)

                    source_config = sources[source_id]

                    # Attempt to load detailed tool descriptions for this mcp-source
                    # this is optional and only used to enrich the tool metadata with a more detailed description, if available
                    # The idea is that by customizing the mcp tool description files,
                    # we can provide better, e.g. usecase specific, descriptions for the tools
                    # We found that the descriptions provided by the MCP sources themselves are often not sufficient for good performance,
                    # so this is a way to enrich them
                    config_descriptions = source_config.descriptions or []
                    for source_tool in source_tools:
                        custom_desc_entry = next(
                            (
                                d
                                for d in config_descriptions
                                if d.name == source_tool.name
                            ),
                            None,
                        )
                        custom_desc = (
                            custom_desc_entry.description if custom_desc_entry else None
                        )

                        existing_metadata = dict(
                            getattr(source_tool, "metadata", {}) or {}
                        )
                        old_description = existing_metadata.pop("description", None)

                        metadata = {
                            **existing_metadata,
                            "mcp_source": source_id,
                            "mcp_group": McpLoader._resolve_group(
                                tool_name=source_tool.name,
                                source_config=source_config,
                            ),
                        }

                        if custom_desc:
                            metadata["description"] = custom_desc
                            source_tool.description = custom_desc
                        elif old_description:
                            metadata["description"] = old_description
                            source_tool.description = old_description

                        source_tool.metadata = metadata

                    McpLoader._logger.info(
                        f"Retrieved MCP tools from '{source_id}': {len(source_tools)}"
                    )
                    tools.extend(source_tools)

                except Exception as e:
                    McpLoader._logger.error(
                        f"Exception while fetching MCP tools from '{source_id}'",
                        exc_info=e,
                    )
                    failed_sources.add(source_id)

            return tools, failed_sources

        redis: Redis = await RedisCache.get_redis()
        lock_name = f"{cache_key}:lock"
        lock = redis.lock(name=lock_name, timeout=60, blocking_timeout=10)

        try:
            async with lock:
                McpLoader._logger.info("Acquired MCP tools lock")

                                # Re-check cache after acquiring the lock unless forced reload
                if not effective_force:
                    tools_dump = await RedisCache.get_object(cache_key)
                    if tools_dump is not None:
                        return tools_dump


                tools, failed_sources = await fetch_all_tools()

                if failed_sources:
                    # Do not cache partial/empty results for the full TTL.
                    if tools:
                        short_ttl = 60  # Short TTL for partial success
                        McpLoader._logger.warning(
                            "Partial MCP tool load: failed sources=%s, caching partial set for %ss",
                            sorted(list(failed_sources)),
                            short_ttl,
                        )
                        await RedisCache.set_object(
                            key=cache_key,
                            obj=tools,
                            ttl=short_ttl,
                        )
                    else:
                        McpLoader._logger.warning(
                            "All MCP sources failed (%s); returning empty set without caching",
                            sorted(list(failed_sources)),
                        )
                    return tools

                # Healthy load: cache with full TTL
                await RedisCache.set_object(
                    key=cache_key,
                    obj=tools,
                    ttl=McpLoader._mcp_settings.CACHE_TTL,
                )
                return tools

        except LockError:
            # Another worker is warming the cache. Wait for a bounded deadline
            # and retry cache reads instead of returning [] immediately.
            McpLoader._logger.warning(
                "Could not acquire MCP tools lock; waiting up to 3s for cache warm-up"
            )
            for _ in range(15):  # ~3s total @ 200ms
                if not effective_force:
                    tools_dump = await RedisCache.get_object(cache_key)
                    if tools_dump is not None:
                        return tools_dump
                await asyncio.sleep(0.2)


            # If still not available, perform an uncached load to avoid hiding tools.
            McpLoader._logger.warning(
                "Cache not ready after wait; performing uncached MCP tool load"
            )
            tools, _failed = await fetch_all_tools()
            return tools
        except Exception as e:
            McpLoader._logger.error(
                "Failed to acquire/use MCP tools lock",
                exc_info=e,
            )
            raise

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
