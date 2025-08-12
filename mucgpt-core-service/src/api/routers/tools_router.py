from fastapi import APIRouter, Depends

from agent.tools.tools import ToolCollection
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
    user_info=Depends(authenticate_user), lang: str = "deutsch"
) -> ToolListResponse:
    """
    Returns a list of all available tools with details, without requiring model initialization.

    Args:
        lang: Language for tool metadata. Supported: deutsch, english, français, bairisch, українська
    """
    return ToolCollection.list_tool_metadata(lang=lang)
