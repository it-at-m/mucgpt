from fastapi import APIRouter, Depends

from agent.tools.tools import ToolCollection
from api.api_models import ToolInfo, ToolListResponse
from config.settings import get_settings
from core.auth import authenticate_user

router = APIRouter(prefix="/v1")

settings = get_settings()


@router.get(
    "/tools",
    summary="List available tools",
    description="Get a list of all available tool names/ids and details.",
    response_model=ToolListResponse,
    responses={200: {"description": "Successful Response"}},
)
async def list_tools(user_info=Depends(authenticate_user)) -> ToolListResponse:
    """
    Returns a list of all available tools with details, without requiring model initialization.
    """
    tools = [
        ToolInfo(name=tool["name"], description=tool["description"])
        for tool in ToolCollection.list_tool_metadata()
    ]
    return ToolListResponse(tools=tools)
