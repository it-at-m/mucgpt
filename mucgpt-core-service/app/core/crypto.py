import base64
import json
import os
from functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config.settings import get_settings
from core.auth_models import AuthenticationResult

_METADATA_CHUNK_SIZE = 190


@lru_cache(maxsize=1)
def _load_public_key(public_key_value: str) -> rsa.RSAPublicKey:
    public_key = serialization.load_pem_public_key(
        base64.b64decode(public_key_value, validate=True)
    )
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise ValueError("USER_TRACE.PUBLIC_KEY must be an RSA public key")
    return public_key


def validate_user_trace_public_key() -> None:
    """Fail startup when the optional user-trace key is invalid."""
    public_key_value = get_settings().USER_TRACE.PUBLIC_KEY
    if public_key_value:
        _load_public_key(public_key_value)


def encrypted_user_metadata(
    user_info: AuthenticationResult | None,
) -> dict[str, str] | None:
    """Encrypt trace identity with the configured public key."""
    public_key_value = get_settings().USER_TRACE.PUBLIC_KEY
    if user_info is None or not public_key_value:
        return None

    public_key = _load_public_key(public_key_value)

    payload = json.dumps(
        {
            "v": 1,
            "user_id": user_info.user_id,
            "name": user_info.name,
            "department": user_info.department,
        },
        separators=(",", ":"),
    ).encode()
    data_key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    ciphertext = AESGCM(data_key).encrypt(nonce, payload, None)
    encrypted_key = public_key.encrypt(
        data_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    envelope = base64.urlsafe_b64encode(
        json.dumps(
            {
                "v": 1,
                "key": base64.urlsafe_b64encode(encrypted_key).decode(),
                "nonce": base64.urlsafe_b64encode(nonce).decode(),
                "data": base64.urlsafe_b64encode(ciphertext).decode(),
            },
            separators=(",", ":"),
        ).encode()
    ).decode()
    chunks = [
        envelope[index : index + _METADATA_CHUNK_SIZE]
        for index in range(0, len(envelope), _METADATA_CHUNK_SIZE)
    ]
    metadata = {
        f"encrypted_user_{index:02d}": chunk for index, chunk in enumerate(chunks)
    }
    metadata["encrypted_user_parts"] = str(len(chunks))
    return metadata
