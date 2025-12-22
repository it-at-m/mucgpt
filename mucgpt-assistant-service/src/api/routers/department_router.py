from fastapi import APIRouter, HTTPException, Query

from api.api_models import DirectoryNode
from core import directory_cache
from core.logtools import getLogger

logger = getLogger("department_router")

router = APIRouter()


@router.get(
    "/directory",
    summary="Get organization directory tree",
    description="Returns a simplified organization directory tree with shortname, name, and children.",
    response_model=list[DirectoryNode],
    responses={200: {"description": "Successful Response"}},
    tags=["Directory"],
)
async def get_directory() -> list[DirectoryNode]:
    tree = await directory_cache.get_simplified_directory_tree()
    return [DirectoryNode(**node) for node in tree]


@router.get(
    "/directory/children",
    summary="Get children of a directory path",
    description=(
        "Walk the directory lazily: provide a sequence of shortnames or names to "
        "retrieve only the children of that node. Empty path returns the roots."
    ),
    response_model=list[DirectoryNode],
    responses={
        200: {"description": "Children for the requested path"},
        404: {"description": "Path segment not found"},
    },
    tags=["Directory"],
)
async def get_directory_children(
    path: list[str] = Query(
        default_factory=list,
        description=(
            "Optional path expressed as repeated query params, e.g. "
            "?path=BAU&path=BAU-BEURL. Matching is case-insensitive and uses "
            "shortname or name."
        ),
    ),
) -> list[DirectoryNode]:
    try:
        children = await directory_cache.get_directory_children_by_path(path)
    except HTTPException:
        raise
    return [DirectoryNode(**node) for node in children]
