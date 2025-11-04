import typing

from httpx import Auth, Request, Response
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.sessions import StreamableHttpConnection

from config.settings import get_mcp_settings
from core.auth_models import AuthenticationResult
from core.logtools import getLogger

logger = getLogger()
# FIXME user global cache?
user_tools : dict[str, list[BaseTool]] = {}

class McpLoader:
    @staticmethod
    async def load_mcp_tools(user_info: AuthenticationResult) -> list[BaseTool]:
        global user_tools
        # return if no connections configured
        sources = get_mcp_settings().SOURCES
        if sources is None or len(sources) == 0:
            return []
        # return tools if already loaded
        if user_info is None:
            raise "No user_info provided for load_mcp_tools"
        uid = user_info.user_id
        if user_tools.get(uid) is not None:
            return user_tools.get(uid)
        # map to mcp connection
        mcp_connections = {}
        for k, v in sources.items():
            con = StreamableHttpConnection(transport="streamable_http", url=v.url)
            # add auth if enabled and user_info present
            if v.forward_token:
                if user_info is not None:
                    con["auth"] = McpBearerAuthProvider(uid=user_info.user_id, token=user_info.token)
                    mcp_connections[k] = con
            else:
                mcp_connections[k] = con
        # create mcp client and get tools
        logger.info(f"Loading mcp tools for user {user_info.user_id}")
        mcp_client = MultiServerMCPClient(connections=mcp_connections)
        tools = []
        for source_id in sources.keys():
            try:
                tools += await mcp_client.get_tools(server_name=source_id)
            except Exception as e:
                logger.error(f"Exception while fetching MCP tools from '{source_id}'", exc_info=e)
        # store user tools
        user_tools[uid] = tools
        return tools


class McpBearerAuthProvider(Auth):
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
            raise "Token is None but needed"
        request.headers["Authorization"] = f"Bearer {token}"
        yield request
