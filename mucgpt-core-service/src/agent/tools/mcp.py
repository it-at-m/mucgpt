import typing

from httpx import Auth, Request, Response
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.sessions import StreamableHttpConnection
from redis.asyncio import Redis

from config.settings import get_mcp_settings
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.logtools import getLogger


class McpLoader:
    _CACHE_PREFIX= "mcp_tools"
    _logger = getLogger()
    _mcp_settings = get_mcp_settings()

    @staticmethod
    async def load_mcp_tools(user_info: AuthenticationResult) -> list[BaseTool]:
        """
        Get MCP tools for given user. Load and caches MCP tools from configured MCP sources.
        :param user_info: The user to get the MCP tools for.
        :return: The loaded or cached MCP tools.
        """
        # return if no connections configured
        sources = McpLoader._mcp_settings.SOURCES
        if sources is None or len(sources) == 0:
            return []
        # return tools if already loaded
        if user_info is None:
            raise ValueError("No user_info provided for load_mcp_tools")
        uid = user_info.user_id
        cache_key = f"{McpLoader._CACHE_PREFIX}:{uid}"
        # return if cached
        tools_dump: list[BaseTool] | None = await RedisCache.get_object(cache_key)
        if tools_dump is not None:
            return tools_dump
        # lock user mcp load
        redis: Redis = await RedisCache.get_redis()
        async with redis.lock(name=f"{cache_key}:lock"):
            # check again if cached incase updated while waiting for lock
            tools_dump: list[BaseTool] | None = await RedisCache.get_object(cache_key)
            if tools_dump is not None:
                return tools_dump
            # map to mcp connection
            mcp_connections = {}
            for k, v in sources.items():
                con = StreamableHttpConnection(transport="streamable_http", url=v.url)
                # add auth if enabled and user_info present
                if v.forward_token:
                    con["auth"] = McpBearerAuthProvider(uid=user_info.user_id, token=user_info.token)
                    mcp_connections[k] = con
                else:
                    mcp_connections[k] = con
            # create mcp client and get tools
            McpLoader._logger.info(f"Loading mcp tools for user {user_info.user_id}")
            mcp_client = MultiServerMCPClient(connections=mcp_connections)
            tools = []
            for source_id in sources.keys():
                try:
                    tools += await mcp_client.get_tools(server_name=source_id)
                except Exception as e:
                    McpLoader._logger.error(f"Exception while fetching MCP tools from '{source_id}'", exc_info=e)
            # store user tools
            await RedisCache.set_object(key=cache_key, obj=tools, ttl=McpLoader._mcp_settings.CACHE_TTL)
            return tools


class McpBearerAuthProvider(Auth):
    """
    Authentication scheme with updatable bearer token per user for MCP requests.
    """
    _tokens : dict[str, str] = {}

    def __init__(self, uid: str, token: str) -> None:
        self._uid = uid
        McpBearerAuthProvider._tokens[uid] = token

    @staticmethod
    def set_token(uid: str, token: str):
        McpBearerAuthProvider._tokens[uid] = token

    def auth_flow(self, request: Request) -> typing.Generator[Request, Response, None]:
        token = McpBearerAuthProvider._tokens.get(self._uid)
        if token is None:
            raise ValueError("Token is None but needed")
        request.headers["Authorization"] = f"Bearer {token}"
        yield request
