from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuthenticationResult(BaseModel):
    """
    Pydantic model representing the result of user authentication.

    Attributes:
        user_id: The LHM Object ID of the authenticated user
        department: The department the user belongs to
        name: The full name of the authenticated user
        roles: List of roles assigned to the user
    """

    token: str
    user_id: str
    department: str
    name: Optional[str] = None
    roles: Optional[list[str]] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "token": "dummy_access_token",
                "user_id": "12345",
                "department": "IT Department",
                "name": "John Doe",
                "roles": ["mucgpt-user"],
            }
        }
    )


class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code
