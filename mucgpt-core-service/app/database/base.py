"""Declarative base for the chat-persistence ORM models.

Kept in its own module so that both the ORM models and the session/engine
helpers can import ``Base`` without creating circular imports.
"""

from __future__ import annotations

from sqlalchemy.orm import declarative_base

Base = declarative_base()
