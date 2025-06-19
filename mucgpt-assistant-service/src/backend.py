from typing import List

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from api.api_models import AssistantCreate, AssistantResponse, AssistantUpdate
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from database.database_models import Assistant, AssistantTool, Owner, Tool
from database.repo import Repository
from database.session import get_db_session

# serves static files and the api
backend = FastAPI(title="MUCGPT-Assistant-Service")
api_app = FastAPI(
    title="MUCGPT Assistant Service API",
    description="""
    ## AI Assistant Management API

    This API provides comprehensive management capabilities for AI assistants.
    """,
    version="0.0.1",
    license_info={
        "name": "MIT",
    },
    tags_metadata=[
        {
            "name": "Assistants",
            "description": "Operations for managing AI assistants including creation, updates, and retrieval",
        },
        {
            "name": "Tools",
            "description": "Operations for managing tools that can be used by assistants",
        },
        {
            "name": "Assistants Owned By User",
            "description": "User-related operations including ownership queries",
        },
        {
            "name": "System",
            "description": "System health and monitoring endpoints",
        },
    ],
)
backend.mount("/api/", api_app)


@api_app.post(
    "/bot/create",
    response_model=AssistantResponse,
    summary="Create a new AI assistant",
    description="""
    Create a new AI assistant with specified configuration, tools, and owners.

    """,
    response_description="The created assistant with all associated data",
    tags=["Assistants"],
)
async def createBot(
    assistant: AssistantCreate,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    # Create a new assistant using the repository
    assistant_repo = Repository(Assistant, db)

    # Create the assistant with basic properties
    new_assistant = assistant_repo.create(
        name=assistant.name,
        description=assistant.description,
        system_prompt=assistant.system_prompt,
    )

    # Add tools if specified
    if assistant.tools:
        tool_repo = Repository(Tool, db)
        for tool_data in assistant.tools:
            tool = tool_repo.session.query(Tool).filter(Tool.id == tool_data.id).first()
            if not tool:
                tool = Tool(id=tool_data.id)
                db.add(tool)

            assistant_tool = AssistantTool(
                assistant=new_assistant, tool=tool, config=tool_data.config
            )
            db.add(assistant_tool)

    # Add owner_ids if specified, and ensure the creating user is always an owner
    owner_ids = list(assistant.owner_ids) if assistant.owner_ids else []

    # Add the user's lhmobjektid if not already present
    if user_info.lhm_object_id not in owner_ids:
        owner_ids.append(user_info.lhm_object_id)

    if owner_ids:
        owner_repo = Repository(Owner, db)
        for owner_id in owner_ids:
            # Get or create the Owner
            owner = (
                owner_repo.session.query(Owner)
                .filter(Owner.lhmobjektID == owner_id)
                .first()
            )
            if not owner:
                owner = Owner(lhmobjektID=owner_id)
                owner_repo.session.add(owner)
            new_assistant.owners.append(owner)

    # Commit changes
    db.commit()
    db.refresh(new_assistant)

    return new_assistant


@api_app.post(
    "/bot/{id}/delete",
    response_model=dict,
    summary="Delete an AI assistant",
    description="""
    Delete an existing AI assistant. Only owners of the assistant can delete it.

    **Security:**
    - Requires authentication
    - Only owners can delete assistants
    - Cascading delete removes all associations

    **Note:** This action is irreversible.
    """,
    response_description="Confirmation message of successful deletion",
    tags=["Assistants"],
)
async def deleteBot(
    id: int,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = Repository(Assistant, db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise HTTPException(status_code=404, detail=f"Assistant with ID {id} not found")

    if not assistant.is_owner(user_info.lhm_object_id):
        raise HTTPException(
            status_code=403,
            detail="Access denied: You must be an owner of this assistant to delete it",
        )

    success = assistant_repo.delete(id)

    if not success:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete assistant with ID {id}"
        )

    return {"message": f"Assistant with ID {id} successfully deleted"}


@api_app.post(
    "/bot/{id}/update",
    response_model=AssistantResponse,
    summary="Update an AI assistant",
    description="""
    Update an existing AI assistant's configuration, tools, or owners.

    **Security:**
    - Requires authentication
    - Only owners can update assistants

    **Note:** When updating tools or owners, the entire list is replaced.
    """,
    response_description="The updated assistant with all current data",
    tags=["Assistants"],
)
async def updateBot(
    id: int,
    assistant_update: AssistantUpdate,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = Repository(Assistant, db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise HTTPException(status_code=404, detail=f"Assistant with ID {id} not found")

    if not assistant.is_owner(user_info.lhm_object_id):
        raise HTTPException(
            status_code=403,
            detail="Access denied: You must be an owner of this assistant to update it",
        )

    # Update basic fields if provided
    update_data = {
        k: v
        for k, v in assistant_update.dict(exclude_unset=True).items()
        if k not in ["tools", "owner_ids"]
    }

    if update_data:
        assistant = assistant_repo.update(id, **update_data)

    # Update tools if provided
    if assistant_update.tools is not None:
        # Clear existing tools
        assistant.tool_associations.clear()

        # Add new tools
        tool_repo = Repository(Tool, db)
        for tool_data in assistant_update.tools:
            tool = tool_repo.session.query(Tool).filter(Tool.id == tool_data.id).first()
            if not tool:
                tool = Tool(id=tool_data.id)
                db.add(tool)

            assistant_tool = AssistantTool(tool=tool, config=tool_data.config)
            assistant.tool_associations.append(assistant_tool)

    # Update owner_ids if provided
    if assistant_update.owner_ids is not None:
        # Clear existing owners
        assistant.owners.clear()

        # Add new owners
        owner_repo = Repository(Owner, db)
        for owner_id in assistant_update.owner_ids:
            # Get or create the Owner
            owner = (
                owner_repo.session.query(Owner)
                .filter(Owner.lhmobjektID == owner_id)
                .first()
            )
            if not owner:
                owner = Owner(lhmobjektID=owner_id)
                owner_repo.session.add(owner)
            assistant.owners.append(owner)

    # Commit changes
    db.commit()
    db.refresh(assistant)

    return assistant


@api_app.get(
    "/bot",
    response_model=List[AssistantResponse],
    summary="Get all accessible assistants",
    description="""
    Retrieve all AI assistants that the current user has access to based on their department
    and organizational hierarchy.

    """,
    response_description="List of all accessible assistants",
    tags=["Assistants"],
)
async def getAllBots(
    db: Session = Depends(get_db_session), user_info=Depends(authenticate_user)
):
    assistant_repo = Repository(Assistant, db)
    assistants = assistant_repo.get_all_possible_assistants_for_user_with_department(
        user_info.department
    )
    return assistants


@api_app.get(
    "/bot/{id}",
    response_model=AssistantResponse,
    summary="Get a specific assistant",
    description="""
    Retrieve detailed information about a specific AI assistant by its ID.

    """,
    response_description="Detailed information about the requested assistant",
    tags=["Assistants"],
)
async def getBot(
    id: int,
    db: Session = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    assistant_repo = Repository(Assistant, db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise HTTPException(status_code=404, detail=f"Assistant with ID {id} not found")

    return assistant


@api_app.get(
    "/user/{lhmobjekt_id}/bots",
    response_model=List[AssistantResponse],
    summary="Get assistants owned by a specific user",
    description="""
    Retrieve all AI assistants where the specified lhmobjektID is listed as an owner.

    """,
    response_description="List of assistants owned by the specified user",
    tags=["Assistants", "Users"],
)
async def getUserBots(
    lhmobjekt_id: str,
    db: Session = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    """Get all assistants where the specified lhmobjektID is an owner."""
    # Get all assistants where this lhmobjektID is an owner
    assistant_repo = Repository(Assistant, db)
    assistants = assistant_repo.get_assistants_by_owner(lhmobjekt_id)

    return assistants


@api_app.get(
    "/health",
    summary="Health check endpoint",
    description="""
    Simple health check endpoint to verify that the API service is running and responsive.
    """,
    response_description="Simple OK status message",
    tags=["System"],
)
def health_check() -> str:
    return "OK"
