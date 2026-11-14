"""Object storage for chat image bytes.

Images are stored once in an S3-compatible bucket; chat messages, checkpoints,
and browser storage only ever carry managed ``mucgpt-image://`` references.
The store is private: no public or presigned URLs are produced, and only the
core service accesses the bucket.
"""

from typing import Protocol

import boto3
import botocore.config
from anyio import to_thread

from config.settings import ImageConfig, ImageStorageConfig
from core.logtools import getLogger

logger = getLogger()


class ImageStorageError(RuntimeError):
    """Image bytes could not be stored, fetched, or removed."""


class ImageStore(Protocol):
    """Minimal bounded interface implemented by object stores."""

    async def put(self, key: str, data: bytes, content_type: str) -> None: ...

    async def get(self, key: str, max_bytes: int) -> bytes: ...

    async def delete(self, key: str) -> None: ...


class S3ImageStore:
    """S3-compatible object store; blocking boto3 calls run in worker threads."""

    def __init__(self, bucket: str, settings: ImageStorageConfig):
        if not bucket:
            raise ImageStorageError("An S3 bucket is required")
        self._bucket = bucket
        self._prefix = settings.key_prefix
        addressing_style = "path" if settings.force_path_style else "auto"
        self._client = boto3.client(
            "s3",
            endpoint_url=(
                settings.endpoint_url.unicode_string()
                if settings.endpoint_url is not None
                else None
            ),
            region_name=settings.region,
            aws_access_key_id=settings.access_key_id,
            aws_secret_access_key=(
                settings.secret_access_key.get_secret_value()
                if settings.secret_access_key is not None
                else None
            ),
            config=botocore.config.Config(
                signature_version="s3v4",
                s3={"addressing_style": addressing_style},
                connect_timeout=5.0,
                read_timeout=30.0,
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def full_key(self, key: str) -> str:
        """Return the bucket key below the configured prefix."""
        return f"{self._prefix.rstrip('/')}/{key.lstrip('/')}"

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        """Upload image bytes with the verified content type and no public ACL."""
        try:
            await to_thread.run_sync(
                lambda: self._client.put_object(
                    Bucket=self._bucket,
                    Key=self.full_key(key),
                    Body=data,
                    ContentType=content_type,
                )
            )
        except Exception as exc:
            raise ImageStorageError(f"Image upload failed for {key!r}") from exc

    async def get(self, key: str, max_bytes: int) -> bytes:
        """Download image bytes, refusing payloads above the metadata size."""
        try:
            response = await to_thread.run_sync(
                lambda: self._client.get_object(
                    Bucket=self._bucket, Key=self.full_key(key)
                )
            )
            body = await to_thread.run_sync(lambda: response["Body"].read(max_bytes + 1))
        except Exception as exc:
            raise ImageStorageError(f"Image download failed for {key!r}") from exc
        if len(body) > max_bytes:
            raise ImageStorageError(f"Stored image {key!r} exceeds its size limit")
        return body

    async def delete(self, key: str) -> None:
        """Remove the object; missing objects are treated as deleted."""
        try:
            await to_thread.run_sync(
                lambda: self._client.delete_object(
                    Bucket=self._bucket, Key=self.full_key(key)
                )
            )
        except Exception as exc:
            raise ImageStorageError(f"Image deletion failed for {key!r}") from exc

    async def verify_access(self) -> None:
        """Confirm the configured bucket is reachable (startup check)."""
        try:
            await to_thread.run_sync(lambda: self._client.head_bucket(Bucket=self._bucket))
        except Exception as exc:
            raise ImageStorageError(
                f"Image bucket {self._bucket!r} is not accessible"
            ) from exc


class ImageStorageManager:
    """Own the process-wide image store; disabled configs publish nothing."""

    _store: ImageStore | None = None

    @staticmethod
    async def init(settings: ImageConfig) -> None:
        """Build the store and verify bucket access; failures stay retryable."""
        if not settings.enabled:
            logger.info("Image input is disabled; no image store initialized")
            return
        s3_config = settings.s3
        if s3_config is None:
            raise ImageStorageError("Image input is enabled without s3 settings")
        store = S3ImageStore(bucket=s3_config.bucket, settings=s3_config)
        await store.verify_access()
        ImageStorageManager._store = store
        logger.info("ImageStorageManager initialized (bucket %s)", s3_config.bucket)

    @staticmethod
    async def close() -> None:
        """Clear the store reference; boto3 clients need no explicit teardown."""
        ImageStorageManager._store = None

    @staticmethod
    def get_store() -> ImageStore:
        """Return the initialized store, raising until readiness."""
        if ImageStorageManager._store is None:
            raise RuntimeError("ImageStorageManager not initialized")
        return ImageStorageManager._store
