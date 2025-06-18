# Pydantic models for request/response validation
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ToolBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AssistantBase(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: str
    organization_path: Optional[str] = None
    is_active: bool = True


class AssistantCreate(AssistantBase):
    tools: Optional[List[int]] = []  # List of tool IDs
    owner_ids: Optional[List[int]] = []  # List of lhmobjektIDs


class AssistantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    organization_path: Optional[str] = None
    is_active: Optional[bool] = None
    tools: Optional[List[int]] = None  # List of tool IDs
    owner_ids: Optional[List[int]] = None  # List of lhmobjektIDs


class LhmobjektIDResponse(BaseModel):
    lhmobjektID: int
    organization_path: Optional[str] = None

    class Config:
        from_attributes = True


class AssistantResponse(AssistantBase):
    id: int
    created_at: datetime
    updated_at: datetime
    tools: List[ToolBase] = []
    owner_ids: List[LhmobjektIDResponse] = []

    class Config:
        from_attributes = True
