from collections.abc import Iterable

from deepagents.backends import StoreBackend
from deepagents.backends.protocol import (
    DeleteResult,
    EditResult,
    FileUploadResponse,
    ReadResult,
    WriteResult,
)
from deepagents.backends.store import NamespaceFactory
from langgraph.store.base import BaseStore


class DocumentBackend(StoreBackend):
    """Close the permission glob's dot-path write gap on the agent mount.

    Reuse StoreBackend reads/searches. All mutations fail at the backend too,
    including direct uploads and middleware writes outside filesystem tools.
    """

    def __init__(
        self,
        *,
        store: BaseStore,
        namespace: NamespaceFactory,
        allowed_paths: Iterable[str] = (),
    ) -> None:
        super().__init__(store=store, namespace=namespace)
        # Snapshot storage keys so caller mutation cannot authorize more files.
        self._allowed_paths = frozenset(allowed_paths)

    def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> ReadResult:
        if file_path not in self._allowed_paths:
            return ReadResult(error="permission denied: document is not attached")
        return super().read(file_path, offset=offset, limit=limit)

    async def aread(
        self, file_path: str, offset: int = 0, limit: int = 2000
    ) -> ReadResult:
        if file_path not in self._allowed_paths:
            return ReadResult(error="permission denied: document is not attached")
        return await super().aread(file_path, offset=offset, limit=limit)

    def write(self, file_path: str, content: str) -> WriteResult:
        return WriteResult(error="permission denied: documents are read-only")

    async def awrite(self, file_path: str, content: str) -> WriteResult:
        return self.write(file_path, content)

    def edit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> EditResult:
        return EditResult(error="permission denied: documents are read-only")

    async def aedit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> EditResult:
        return self.edit(file_path, old_string, new_string, replace_all)

    def delete(self, file_path: str) -> DeleteResult:
        return DeleteResult(error="permission denied: documents are read-only")

    async def adelete(self, file_path: str) -> DeleteResult:
        return self.delete(file_path)

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        return [
            FileUploadResponse(path=path, error="permission_denied")
            for path, _content in files
        ]

    async def aupload_files(
        self, files: list[tuple[str, bytes]]
    ) -> list[FileUploadResponse]:
        return self.upload_files(files)
