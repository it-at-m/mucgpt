"""Integration tests for the conversations CRUD router (no model endpoint)."""

from fastapi.testclient import TestClient

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult

BASE = "/v1/conversations"


def test_create_then_list_and_get(test_client: TestClient) -> None:
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


def test_get_unknown_returns_404(test_client: TestClient) -> None:
    assert test_client.get(f"{BASE}/nope").status_code == 404


def test_patch_updates_title_and_favorite(test_client: TestClient) -> None:
    conv_id = test_client.post(BASE, json={"title": "old"}).json()["id"]

    patched = test_client.patch(
        f"{BASE}/{conv_id}", json={"title": "renamed", "favorite": True}
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["title"] == "renamed"
    assert patched.json()["favorite"] is True


def test_append_message(test_client: TestClient) -> None:
    conv_id = test_client.post(BASE, json={"title": "chat"}).json()["id"]

    appended = test_client.post(
        f"{BASE}/{conv_id}/messages",
        json={"message": {"role": "user", "content": "first"}},
    )
    assert appended.status_code == 200, appended.text
    detail = appended.json()
    assert [m["content"] for m in detail["messages"]] == ["first"]


def test_delete_then_404(test_client: TestClient) -> None:
    conv_id = test_client.post(BASE, json={"title": "temp"}).json()["id"]

    deleted = test_client.delete(f"{BASE}/{conv_id}")
    assert deleted.status_code == 204
    assert test_client.get(f"{BASE}/{conv_id}").status_code == 404


def test_delete_is_soft_and_recreate_returns_409(test_client: TestClient) -> None:
    """Deleting 404s the chat thereafter; re-creating its id is rejected with
    409 (anti-resurrection) and writes nothing."""
    conv_id = test_client.post(BASE, json={"title": "ghost"}).json()["id"]

    assert test_client.delete(f"{BASE}/{conv_id}").status_code == 204
    assert test_client.get(f"{BASE}/{conv_id}").status_code == 404

    recreate = test_client.post(BASE, json={"id": conv_id, "title": "resurrected"})
    assert recreate.status_code == 409, recreate.text
    detail = recreate.json()["detail"]
    assert detail["conversation_id"] == conv_id

    # The 409 wrote nothing: the chat stays gone (still 404, not "resurrected").
    assert test_client.get(f"{BASE}/{conv_id}").status_code == 404
    assert all(c["id"] != conv_id for c in test_client.get(BASE).json())


def test_tombstone_feed_lists_deleted_with_since_cursor(test_client: TestClient) -> None:
    first = test_client.post(BASE, json={"title": "one"}).json()["id"]
    second = test_client.post(BASE, json={"title": "two"}).json()["id"]
    assert test_client.delete(f"{BASE}/{first}").status_code == 204
    assert test_client.delete(f"{BASE}/{second}").status_code == 204

    feed = test_client.get(f"{BASE}/deleted")
    assert feed.status_code == 200, feed.text
    ids = {item["id"] for item in feed.json()}
    assert {first, second} <= ids

    # since=<first tombstone's deleted_at> returns only strictly-newer ones.
    items = sorted(feed.json(), key=lambda i: i["deleted_at"])
    cursor = items[0]["deleted_at"]
    newer = test_client.get(f"{BASE}/deleted", params={"since": cursor})
    assert newer.status_code == 200
    newer_ids = {item["id"] for item in newer.json()}
    assert items[0]["id"] not in newer_ids


def test_tombstone_feed_is_owner_scoped(test_client: TestClient) -> None:
    """One user's tombstones never leak into another user's feed."""
    conv_id = test_client.post(BASE, json={"title": "mine"}).json()["id"]
    assert test_client.delete(f"{BASE}/{conv_id}").status_code == 204

    async def _other_user() -> AuthenticationResult:
        return AuthenticationResult(
            token="t",
            user_id="other_user_777",
            name="Other",
            email="other@example.com",
            department="X",
            is_authenticated=True,
        )

    api_app.dependency_overrides[authenticate_user] = _other_user
    try:
        feed = test_client.get(f"{BASE}/deleted")
        assert feed.status_code == 200
        assert all(item["id"] != conv_id for item in feed.json())
    finally:
        pass


def test_cross_user_isolation(test_client: TestClient) -> None:
    """A conversation created by user A is invisible to user B."""
    conv_id = test_client.post(BASE, json={"title": "private"}).json()["id"]

    async def _other_user() -> AuthenticationResult:
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
