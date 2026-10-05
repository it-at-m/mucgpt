from pydantic import BaseModel


class AuthenticationResult(BaseModel):
    """
    Pydantic model representing the result of user authentication.

    Attributes:
        user_id: The configured user ID of the authenticated user
        department: The organization unit the user belongs to
        name: The full name of the authenticated user
        roles: List of roles assigned to the user
        is_admin: Whether the user holds the configured admin role
    """

    user_id: str
    department: str
    name: str | None = None
    roles: list[str] | None = None
    is_admin: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "12345",
                "department": "demo-team-a",
                "name": "John Doe",
                "roles": ["mucgpt-user"],
                "is_admin": False,
            }
        }


class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code
