from fastapi import APIRouter, Depends

from agent.tools.tool_metadata import list_tool_metadata
from api.api_models import ToolListResponse
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
async def list_tools(
    user_info=Depends(authenticate_user),
    lang: str = "deutsch",
    force_reload: bool = False,
) -> ToolListResponse:
    """
    Returns a list of all available tools with details, without requiring model initialization.

        Args:
        :param user_info: Authenticated user
        :param lang: Language for tool metadata. Supported: deutsch, english, français, bairisch, українська
        :param force_reload: If true, bypass cache and force-refresh MCP tools for this request
    """
    return await list_tool_metadata(
        lang=lang, user_info=user_info, force_reload=force_reload
    )
