from langchain_core.tools.base import BaseTool

from agent.tools.brainstorm import make_brainstorm_tool
from agent.tools.mcp import McpLoader
from agent.tools.simplify import make_simplify_tool
from core.auth import AuthenticationResult
from core.logtools import getLogger


class MUCGPTTools:
    """loads all tools provided by the system stack"""
    def __init__(self, model) -> None:
        self.logger = getLogger(name="mucgpt-core-tools")
        self.model = model

    async def get_tools(self, user_info: AuthenticationResult | None) -> list[BaseTool]:
        """get all MUCGPT tools"""
        if user_info is not None:
            self.model = self.model.bind(user=user_info)  # bind user info to model for tools that need it
        brainstorm_tool = make_brainstorm_tool(self.model, self.logger)
        simplify_tool = make_simplify_tool(self.model, self.logger)
        return [brainstorm_tool, simplify_tool]

class MCPTools:
    """loads tools from remote MCP sources"""
    def __init__(self) -> None:
        self.logger = getLogger(name="mucgpt-core-mcp-tools")

    async def get_tools(self, user_info: AuthenticationResult) -> list[BaseTool]:
        """get tools from remote MCP sources for given user"""
        self.logger.info(f"Loading MCP tools for user {user_info.user_id}...")
        return await McpLoader.load_mcp_tools(user_info)

class ToolCollection:
    """collection of all tools available to the agent, including system tools and remote MCP tools"""
    def __init__(self, model) -> None:
        self.logger = getLogger(name="mucgpt-core-tool-collection")
        self.mucgpt_tools = MUCGPTTools(model=model)
        self.mcp_tools = MCPTools()