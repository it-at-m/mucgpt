import json

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
    path: str | None = Query(
        default=None,
        description=(
            'Optional path. Can be a JSON array string (e.g. \'["A","B"]\') '
            "or a single path segment. "
            "Matching is case-insensitive and uses shortname or name."
        ),
    ),
) -> list[DirectoryNode]:
    path_list: list[str] = []
    if path:
        try:
            decoded = json.loads(path)
            if isinstance(decoded, list):
                path_list = [str(p) for p in decoded]
            else:
                path_list = [str(decoded)]
        except json.JSONDecodeError:
            path_list = [path]

    try:
        children = await directory_cache.get_directory_children_by_path(path_list)
    except HTTPException:
        raise

    # Return shallow nodes (without children) to support lazy loading
    result = []
    for node in children:
        node_copy = node.copy()
        # If the node has children in the cache, we mark it as having children
        # but don't include them in the response payload.
        # The frontend can then query for children if needed.

        # Let's check if the node has children.
        has_children = bool(node.get("children"))

        # We strip the children from the response to keep it lightweight
        # If has_children is True, we set children to None (indicating they exist but are not loaded)
        # If has_children is False, we set children to [] (indicating leaf node)
        # Note: DirectoryNode model has been updated to allow None for children
        node_copy["children"] = None if has_children else []

        result.append(DirectoryNode(**node_copy))

    return result
