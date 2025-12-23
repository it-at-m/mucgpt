from .assistants_router import router as assistants_router
from .department_router import router as department_router
from .system_router import router as system_router
from .users_router import router as users_router

__all__ = [
    "assistants_router",
    "department_router",
    "system_router",
    "users_router",
]
