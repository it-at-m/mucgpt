import asyncio
import json
import os

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
    async def load_mcp_tools(user_info: AuthenticationResult) -> list[BaseTool]:
        """
        Load MCP tools for a given user and cache them.
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

        tools_dump: list[BaseTool] | None = await RedisCache.get_object(cache_key)
        if tools_dump is not None:
            return tools_dump

        redis: Redis = await RedisCache.get_redis()
        lock_name = f"{cache_key}:lock"
        lock = redis.lock(name=lock_name, timeout=60, blocking_timeout=10)

        try:
            async with lock:
                McpLoader._logger.info(
                    f"Acquired MCP tools lock '{lock_name}' for user {uid}"
                )

                tools_dump = await RedisCache.get_object(cache_key)
                if tools_dump is not None:
                    return tools_dump

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

                McpLoader._logger.info(f"Loading MCP tools for user {uid}")
                mcp_client = MultiServerMCPClient(connections=mcp_connections)

                tools: list[BaseTool] = []

                for source_id in mcp_connections.keys():
                    try:
                        source_tools = await mcp_client.get_tools(server_name=source_id)

                        path = os.path.join(
                            os.path.dirname(__file__),
                            "mcp-descriptions",
                            f"{source_id}.json",
                        )

                        tool_descriptions = []
                        try:
                            with open(path, encoding="utf-8") as f:
                                tool_descriptions = json.load(f)
                        except FileNotFoundError:
                            McpLoader._logger.warning(
                                f"Description file not found for MCP source '{source_id}': {path}"
                            )

                        for source_tool in source_tools:
                            description_entry = next(
                                (
                                    desc
                                    for desc in tool_descriptions
                                    if desc["name"] == source_tool.name
                                ),
                                None,
                            )

                            existing_metadata = dict(
                                getattr(source_tool, "metadata", {}) or {}
                            )
                            existing_metadata.pop("description", None)

                            metadata = {
                                **existing_metadata,
                                "mcp_source": source_id,
                                "mcp_group": McpLoader._resolve_group(
                                tool_name=source_tool.name,
                                source_config=sources[source_id],
                                ),
                            }

                            if description_entry is not None:
                                new_description = description_entry.get(
                                    "description", ""
                                )
                                metadata["description"] = new_description
                                source_tool.description = new_description

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

                await RedisCache.set_object(
                    key=cache_key,
                    obj=tools,
                    ttl=McpLoader._mcp_settings.CACHE_TTL,
                )
                return tools

        except LockError:
            McpLoader._logger.warning(
                f"Could not acquire MCP lock '{lock_name}' for user {uid}; retrying cache read"
            )
            await asyncio.sleep(0.3)
            tools_dump = await RedisCache.get_object(cache_key)
            if tools_dump is not None:
                return tools_dump
            return []
        except Exception as e:
            McpLoader._logger.error(
                f"Failed to acquire/use MCP lock '{lock_name}' for user {uid}",
                exc_info=e,
            )
            raise

    @staticmethod
    def _resolve_group(
        tool_name: str, source_config: MCPSourceConfig
    ) -> str | None:
        """Resolve the group for a tool: check tool_groups prefixes first, fall back to group."""
        if source_config.tool_groups:
            lowered = tool_name.lower()
            for prefix, group in source_config.tool_groups.items():
                if lowered.startswith(prefix.lower()):
                    return group
        return source_config.group


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
            McpLoader._logger.warning(
                f"Given authentication token was not normalized for user '{self._uid}'."
            )
        scheme, sep, _ = normalized.partition(" ")
        if sep and scheme.lower() in {"bearer", "basic"}:
            request.headers["Authorization"] = normalized
        else:
            request.headers["Authorization"] = f"Bearer {normalized}"

        yield request