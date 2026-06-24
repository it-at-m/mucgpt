import itertools
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from database.base import Base
from database.session import get_db_session


class FakeChatModel(GenericFakeChatModel):
    """Offline chat model for tests.

    Inherits GenericFakeChatModel's scripted streaming/non-streaming behavior and
    adds a no-op ``bind_tools`` so it composes with LangGraph's ``create_agent``
    (which binds tools to the model at graph construction).
    """

    def bind_tools(self, tools, **kwargs):  # noqa: D401 - simple passthrough
        return self


@pytest.fixture
def override_authenticate_user():
    """Override the authentication dependency."""

    async def _get_test_user():
        return AuthenticationResult(
            token="dummy_access_token",
            user_id="test_user_123",
            name="Test User",
            email="test@example.com",
            department="IT-Test-Department",
            is_authenticated=True,
        )

    return _get_test_user


@pytest_asyncio.fixture
async def db_sessionmaker():
    """A shared in-memory SQLite engine + session factory for integration tests.

    Uses StaticPool so every session sees the same in-memory database within a
    test, and disposes the engine afterwards for isolation between tests.
    """
    # Import models so their tables register on Base.metadata.
    import database.models  # noqa: F401

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


@pytest.fixture
def test_client(override_authenticate_user, db_sessionmaker):
    """Create a test client with authentication and database overrides."""

    async def _get_test_session():
        async with db_sessionmaker() as session:
            yield session

    # Apply dependency overrides to the API app
    api_app.dependency_overrides[authenticate_user] = override_authenticate_user
    api_app.dependency_overrides[get_db_session] = _get_test_session

    # Create test client using the backend which has the API mounted at /api/
    client = TestClient(api_app)

    yield client

    # Clear overrides after test
    api_app.dependency_overrides.clear()


@pytest.fixture
def fake_chat_model():
    """A FakeChatModel that cycles through scripted assistant replies.

    Cycling keeps it producing for multi-turn tests without exhausting.
    """
    return FakeChatModel(
        messages=itertools.cycle(
            [
                AIMessage(content="Hello from the fake model."),
                AIMessage(content="Second fake reply."),
            ]
        )
    )


@pytest.fixture
def test_client_with_fake_model(override_authenticate_user, db_sessionmaker, fake_chat_model):
    """Test client wired for fully offline chat: fake model + in-memory DB +
    in-process MemorySaver checkpointer.

    Patches the model provider and tool discovery so ``init_agent`` builds a real
    agent graph (real executor, persistence, and checkpointer) around the fake
    model with no tools and no network.
    """

    async def _get_test_session():
        async with db_sessionmaker() as session:
            yield session

    checkpointer = MemorySaver()

    api_app.dependency_overrides[authenticate_user] = override_authenticate_user
    api_app.dependency_overrides[get_db_session] = _get_test_session

    with (
        patch(
            "config.model_provider.ModelProvider.get_model",
            return_value=fake_chat_model,
        ),
        patch(
            "init_app.ModelProvider.get_model",
            return_value=fake_chat_model,
        ),
        patch(
            "init_app.ToolCollection.get_tools",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "init_app.CheckpointerProvider.get_checkpointer",
            return_value=checkpointer,
        ),
    ):
        client = TestClient(api_app)
        client.checkpointer = checkpointer  # exposed for assertions
        yield client

    api_app.dependency_overrides.clear()
