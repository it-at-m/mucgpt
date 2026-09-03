import base64
import json
from types import SimpleNamespace

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from core.auth_models import AuthenticationResult
from core.crypto import encrypted_user_metadata, validate_user_trace_public_key


@pytest.fixture
def keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_key, base64.b64encode(public_pem).decode()


def _settings(public_key):
    return SimpleNamespace(USER_TRACE=SimpleNamespace(PUBLIC_KEY=public_key))


def test_encrypted_user_metadata_round_trip(monkeypatch, keypair):
    private_key, public_key = keypair
    monkeypatch.setattr("core.crypto.get_settings", lambda: _settings(public_key))
    user = AuthenticationResult(
        token="secret",
        user_id="12345",
        name="Jane Doe",
        department="ITM-AI",
    )

    metadata = encrypted_user_metadata(user)

    assert metadata is not None
    assert all(len(value) <= 200 for value in metadata.values())
    chunks = int(metadata["encrypted_user_parts"])
    token = "".join(metadata[f"encrypted_user_{index:02d}"] for index in range(chunks))
    envelope = json.loads(base64.urlsafe_b64decode(token))
    data_key = private_key.decrypt(
        base64.urlsafe_b64decode(envelope["key"]),
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    payload = AESGCM(data_key).decrypt(
        base64.urlsafe_b64decode(envelope["nonce"]),
        base64.urlsafe_b64decode(envelope["data"]),
        None,
    )

    assert json.loads(payload) == {
        "v": 1,
        "user_id": "12345",
        "name": "Jane Doe",
        "department": "ITM-AI",
    }
    assert "secret" not in payload.decode()


def test_encrypted_user_metadata_is_disabled_without_key(monkeypatch):
    monkeypatch.setattr("core.crypto.get_settings", lambda: _settings(None))

    assert encrypted_user_metadata(None) is None


def test_encrypted_user_metadata_changes_for_each_trace(monkeypatch, keypair):
    _, public_key = keypair
    monkeypatch.setattr("core.crypto.get_settings", lambda: _settings(public_key))
    user = AuthenticationResult(
        token="secret",
        user_id="12345",
        name="Jane Doe",
        department="ITM-AI",
    )

    assert encrypted_user_metadata(user) != encrypted_user_metadata(user)


def test_invalid_public_key_fails_validation(monkeypatch):
    monkeypatch.setattr("core.crypto.get_settings", lambda: _settings("invalid"))

    with pytest.raises(ValueError):
        validate_user_trace_public_key()
