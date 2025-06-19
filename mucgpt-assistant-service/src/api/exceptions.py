from fastapi import HTTPException


class AuthenticationException(HTTPException):
    def __init__(self, detail: str, status_code: int = 401):
        super().__init__(status_code=status_code, detail=detail)


class AssistantNotFoundException(HTTPException):
    def __init__(self, assistant_id: int):
        super().__init__(
            status_code=404, detail=f"Assistant with ID {assistant_id} not found"
        )


class NotOwnerException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=403,
            detail="Access denied: You must be an owner of this assistant to perform this action",
        )


class VersionConflictException(HTTPException):
    def __init__(self, provided_version: int, latest_version: int):
        super().__init__(
            status_code=409,
            detail=f"Version conflict: You are trying to update version {provided_version}, but the latest version is {latest_version}.",
        )


class NoVersionException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=500, detail="Assistant has no versions, cannot update"
        )


class DeleteFailedException(HTTPException):
    def __init__(self, assistant_id: int):
        super().__init__(
            status_code=500, detail=f"Failed to delete assistant with ID {assistant_id}"
        )
