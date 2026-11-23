"""Test configuration and fixtures."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core import directory_cache
from database.database_models import AssistantVersion, Base
from tests import container_runtime
from tests.shared_directory_tree import TEST_TREE

_POSTGRES_CONTAINER = None
_POSTGRES_ENGINE_URL: str | None = None

# The DB-layer suite runs against in-memory SQLite (default) and, when a
# container runtime is reachable, against a real PostgreSQL testcontainer.
if container_runtime.postgres_container_requested():
    _ENGINE_PARAMS = ["sqlite", "postgres"]
else:
    _ENGINE_PARAMS = ["sqlite"]


def _postgres_engine_url() -> str:
    """Start the shared Postgres testcontainer on first use."""
    global _POSTGRES_CONTAINER, _POSTGRES_ENGINE_URL
    if _POSTGRES_ENGINE_URL is None:
        container = container_runtime.start_postgres_container()
        if container is None:
            pytest.skip("no container runtime reachable for PostgreSQL tests")
        _POSTGRES_CONTAINER = container
        _POSTGRES_ENGINE_URL = container_runtime.postgres_engine_url(container)
    return _POSTGRES_ENGINE_URL


def _suppress_coverage_gate_for_partial_runs(config: pytest.Config) -> None:
    """Coverage gates only make sense for full-suite runs.

    A partial run (e.g. `uv run pytest tests/database`) collects a subset and
    would always report less coverage, so the `--cov-fail-under` gate from
    addopts is disabled for it. An explicit `--cov-fail-under` on the command
    line is kept.

    Note: pytest-cov reads the value from `config.known_args_namespace`
    (snapshot taken before conftests load), not from `config.option`, so both
    namespaces are adjusted.
    """
    if config.option.cov_fail_under is None:
        return
    if any(
        str(arg).startswith("--cov-fail-under") for arg in config.invocation_params.args
    ):
        return  # explicitly requested on the command line — respect it
    args = [str(arg) for arg in config.args]
    testpaths = [str(path) for path in config.getini("testpaths")]
    has_test_selection = bool(config.option.keyword or config.option.markexpr)
    if not has_test_selection and (not args or (testpaths and args == testpaths)):
        return  # full run — keep the gate
    config.option.cov_fail_under = 0
    known_args = getattr(config, "known_args_namespace", None)
    if known_args is not None and getattr(known_args, "cov_fail_under", None):
        known_args.cov_fail_under = 0


def pytest_configure(config: pytest.Config) -> None:
    _suppress_coverage_gate_for_partial_runs(config)


def pytest_unconfigure(config: pytest.Config) -> None:
    global _POSTGRES_CONTAINER
    if _POSTGRES_CONTAINER is not None:
        _POSTGRES_CONTAINER.stop()
        _POSTGRES_CONTAINER = None
        _POSTGRES_ENGINE_URL = None


@pytest_asyncio.fixture(params=_ENGINE_PARAMS, ids=_ENGINE_PARAMS)
async def async_engine(request: pytest.FixtureRequest):
    """Create an in-memory SQLite or (parameterized) PostgreSQL test database."""
    if request.param == "postgres":
        engine = create_async_engine(_postgres_engine_url(), echo=False)
    else:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        if request.param == "postgres":
            # The container database is shared across tests; drop stale tables
            # so every test starts from a clean schema, like the in-memory DB.
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine):
    """Create a database session for testing."""
    SessionLocal = async_sessionmaker(bind=async_engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest.fixture
def sample_assistant_data():
    """Sample data for creating assistants."""
    return {"hierarchical_access": "DEPT-TEAM", "owner_ids": ["user1", "user2"]}


@pytest.fixture
def sample_assistant_version_data():
    """Sample AssistantVersion instance with proper type safety."""
    return AssistantVersion(
        name="Test Assistant",
        system_prompt="You are a helpful assistant",
        description="A test assistant for unit testing",
        creativity="medium",
        examples=["Example 1", "Example 2"],
        quick_prompts=["Quick prompt 1", "Quick prompt 2"],
        tags=["tag1", "tag2"],
    )


@pytest.fixture(scope="session", autouse=True)
def mock_directory_cache():
    """Force directory cache to return a deterministic tree for access checks."""

    mp = pytest.MonkeyPatch()

    async def _get_tree():
        return TEST_TREE

    mp.setattr(directory_cache, "get_simplified_directory_tree", _get_tree)
    # Clear any cached index in path_matcher when the session ends to avoid bleed-over
    yield
    mp.undo()
    try:
        from database import path_matcher

        path_matcher._INDEX_CACHE["index"] = None
        path_matcher._INDEX_CACHE["expires_at"] = None
    except Exception:
        pass
