from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

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
    tool_list = await list_tool_metadata(
        lang=lang, user_info=user_info, force_reload=force_reload
    )
    tool_list.tools = [tool for tool in tool_list.tools if tool.access == "public"]
    return tool_list


@router.get(
    "/tools/metadata",
    summary="Get tool metadata by ID",
    description="Get display metadata for specific tool IDs, including restricted tools.",
    response_model=ToolListResponse,
    responses={200: {"description": "Successful Response"}},
)
async def get_tool_metadata(
    tool_ids: Annotated[
        list[str], Query(alias="tool_id", min_length=1, max_length=100)
    ],
    user_info=Depends(authenticate_user),
    lang: str = "deutsch",
) -> ToolListResponse:
    """Return non-sensitive display metadata for requested tool IDs."""
    tool_list = await list_tool_metadata(lang=lang, user_info=user_info)
    requested_tool_ids = set(tool_ids)
    tool_list.tools = [
        tool for tool in tool_list.tools if tool.id in requested_tool_ids
    ]
    return tool_list


@router.get(
    "/admin/tools",
    summary="List tools for assistant availability administration",
    description="Get tool metadata and availability classification for administrator-managed assistant grants.",
    response_model=ToolListResponse,
    responses={200: {"description": "Successful Response"}},
)
async def list_admin_tools(
    user_info=Depends(authenticate_user),
    lang: str = "deutsch",
    force_reload: bool = False,
) -> ToolListResponse:
    """Return the tools the administrator can manage, including their access class."""
    if not user_info.is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")

    return await list_tool_metadata(
        lang=lang, user_info=user_info, force_reload=force_reload
    )
