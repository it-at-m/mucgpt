import pytest
from fastapi.testclient import TestClient

from backend import api_app


@pytest.fixture(autouse=True)
def clear_file_storage():
    """Reset the in-memory file storage between every test."""
    import api.routers.parsing_router as pr

    pr.file_storage.clear()
    yield
    pr.file_storage.clear()


@pytest.fixture
def test_client() -> TestClient:
    """Return a TestClient backed by the API sub-application."""
    return TestClient(api_app)
