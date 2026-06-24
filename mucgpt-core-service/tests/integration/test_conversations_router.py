"""Integration tests for the conversations CRUD router (no model endpoint)."""

from fastapi.testclient import TestClient

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult

BASE = "/v1/conversations"


def test_create_then_list_and_get(test_client: TestClient):
    create = test_client.post(
        BASE,
        json={
            "title": "Onboarding",
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )
    assert create.status_code == 200, create.text
    body = create.json()
    conv_id = body["id"]
    assert body["title"] == "Onboarding"
    assert [m["content"] for m in body["messages"]] == ["hello"]

    listed = test_client.get(BASE)
    assert listed.status_code == 200
    assert any(c["id"] == conv_id for c in listed.json())

    got = test_client.get(f"{BASE}/{conv_id}")
    assert got.status_code == 200
    assert got.json()["messages"][0]["role"] == "user"


def test_get_unknown_returns_404(test_client: TestClient):
    assert test_client.get(f"{BASE}/nope").status_code == 404


def test_patch_updates_title_and_favorite(test_client: TestClient):
    conv_id = test_client.post(BASE, json={"title": "old"}).json()["id"]

    patched = test_client.patch(
        f"{BASE}/{conv_id}", json={"title": "renamed", "favorite": True}
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["title"] == "renamed"
    assert patched.json()["favorite"] is True


def test_append_message(test_client: TestClient):
    conv_id = test_client.post(BASE, json={"title": "chat"}).json()["id"]

    appended = test_client.post(
        f"{BASE}/{conv_id}/messages",
        json={"message": {"role": "user", "content": "first"}},
    )
    assert appended.status_code == 200, appended.text
    detail = appended.json()
    assert [m["content"] for m in detail["messages"]] == ["first"]


def test_delete_then_404(test_client: TestClient):
    conv_id = test_client.post(BASE, json={"title": "temp"}).json()["id"]

    deleted = test_client.delete(f"{BASE}/{conv_id}")
    assert deleted.status_code == 204
    assert test_client.get(f"{BASE}/{conv_id}").status_code == 404


def test_cross_user_isolation(test_client: TestClient):
    """A conversation created by user A is invisible to user B."""
    conv_id = test_client.post(BASE, json={"title": "private"}).json()["id"]

    async def _other_user():
        return AuthenticationResult(
            token="t",
            user_id="other_user_999",
            name="Other",
            email="other@example.com",
            department="X",
            is_authenticated=True,
        )

    api_app.dependency_overrides[authenticate_user] = _other_user
    try:
        assert test_client.get(f"{BASE}/{conv_id}").status_code == 404
        assert test_client.delete(f"{BASE}/{conv_id}").status_code == 404
        assert all(c["id"] != conv_id for c in test_client.get(BASE).json())
    finally:
        # Restore handled by the fixture teardown, but keep tests independent.
        pass
