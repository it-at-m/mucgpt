from typing import List

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from api.models import AssistantCreate, AssistantResponse, AssistantUpdate
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from database.models import Assistant, Owner, Tool
from database.repo import Repository
from database.session import get_db_session

# serves static files and the api
backend = FastAPI(title="MUCGPT-Assistant-Service")
api_app = FastAPI(title="MUCGPT-Assistant-Service-API")
backend.mount("/api/", api_app)


@api_app.post("/bot/create", response_model=AssistantResponse)
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
        organization_path=assistant.organization_path,
        is_active=assistant.is_active,
    )

    # Add tools if specified
    if assistant.tools:
        tool_repo = Repository(Tool, db)
        for tool_id in assistant.tools:
            tool = tool_repo.get(tool_id)
            if tool:
                new_assistant.tools.append(
                    tool
                )  # Add owner_ids if specified, and ensure the creating user is always an owner
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


@api_app.post("/bot/{id}/delete", response_model=dict)
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


@api_app.post("/bot/{id}/update", response_model=AssistantResponse)
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
        assistant.tools.clear()

        # Add new tools
        tool_repo = Repository(Tool, db)
        for tool_id in assistant_update.tools:
            tool = tool_repo.get(tool_id)
            if tool:
                assistant.tools.append(tool)
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


@api_app.get("/bot", response_model=List[AssistantResponse])
async def getAllBots(
    db: Session = Depends(get_db_session), user_info=Depends(authenticate_user)
):
    assistant_repo = Repository(Assistant, db)
    assistants = assistant_repo.get_all_possible_assistants_for_user_with_department(
        user_info.department
    )
    return assistants


@api_app.get("/bot/{id}", response_model=AssistantResponse)
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


@api_app.get("/user/{lhmobjekt_id}/bots", response_model=List[AssistantResponse])
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


@api_app.get("/health")
def health_check() -> str:
    return "OK"
