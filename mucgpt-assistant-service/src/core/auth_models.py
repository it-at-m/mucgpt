from typing import Optional

from pydantic import BaseModel


class AuthenticationResult(BaseModel):
    """
    Pydantic model representing the result of user authentication.

    Attributes:
        lhm_object_id: The LHM Object ID of the authenticated user
        department: The department the user belongs to
        name: The full name of the authenticated user
        roles: List of roles assigned to the user
    """

    lhm_object_id: str
    department: str
    name: Optional[str] = None
    roles: Optional[list[str]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "lhm_object_id": "12345",
                "department": "IT Department",
                "name": "John Doe",
                "roles": ["mucgpt-user"],
            }
        }


class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code
