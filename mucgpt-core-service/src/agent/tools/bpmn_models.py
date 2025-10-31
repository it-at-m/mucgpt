from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ProcessStep(BaseModel):
    """Represents a single step in a business process."""

    step_id: str = Field(..., description="Unique identifier for the step")
    step_type: Literal["task", "gateway", "event"] = Field(
        ..., description="Type of BPMN element: task, gateway, or event"
    )
    name: str = Field(..., description="Name/label of the step")
    description: Optional[str] = Field(None, description="Detailed description")
    gateway_type: Optional[Literal["exclusive", "parallel", "inclusive"]] = Field(
        None, description="Type of gateway if step_type is 'gateway'"
    )
    event_type: Optional[Literal["start", "end", "intermediate"]] = Field(
        None, description="Type of event if step_type is 'event'"
    )


class ProcessFlow(BaseModel):
    """Represents a connection between two process steps."""

    from_step: str = Field(..., description="ID of the source step")
    to_step: str = Field(..., description="ID of the target step")
    condition: Optional[str] = Field(
        None, description="Condition for this flow (for gateways)"
    )


class ProcessStructure(BaseModel):
    """Complete structured representation of a business process."""

    process_name: str = Field(..., description="Name of the business process")
    process_description: Optional[str] = Field(
        None, description="Overall description of the process"
    )
    steps: List[ProcessStep] = Field(
        ..., description="List of all steps in the process"
    )
    flows: List[ProcessFlow] = Field(
        ..., description="List of all connections between steps"
    )
