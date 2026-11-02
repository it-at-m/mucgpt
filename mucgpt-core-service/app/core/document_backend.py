from collections.abc import Iterable

from deepagents.backends import StoreBackend
from deepagents.backends.protocol import (
    DeleteResult,
    EditResult,
    FileData,
    FileDownloadResponse,
    FileUploadResponse,
    GlobResult,
    GrepResult,
    LsResult,
    ReadResult,
    WriteResult,
)
from deepagents.backends.store import NamespaceFactory
from deepagents.backends.utils import (
    _filter_files_by_path,
    _normalize_path,
    _relative_to_root,
    compile_grep_include_glob,
    grep_matches_from_files,
    validate_path,
)
from langgraph.store.base import BaseStore


class DocumentBackend(StoreBackend):
    """Read-only agent mount with reads and text search scoped to attachments.

    Reuse StoreBackend readers and shared text-search helpers. Mutations fail here,
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

    def ls(self, path: str) -> LsResult:
        return LsResult(error="permission denied: document listing is disabled")

    async def als(self, path: str) -> LsResult:
        return self.ls(path)

    def glob(self, pattern: str, path: str | None = "/") -> GlobResult:
        return GlobResult(error="permission denied: document glob is disabled")

    async def aglob(self, pattern: str, path: str | None = "/") -> GlobResult:
        return self.glob(pattern, path)

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

    def _grep_paths(self, path: str | None, glob: str | None) -> list[str]:
        """Resolve search candidates before fetching any document bodies."""
        root = _normalize_path(path)
        # Validate without normalizing an alias into an authorized storage key.
        validate_path(root)
        if root.endswith(".txt") and root not in self._allowed_paths:
            raise ValueError("permission denied: document is not attached")
        candidates = _filter_files_by_path(
            dict.fromkeys(sorted(self._allowed_paths)), root
        )
        if glob:
            matcher = compile_grep_include_glob(glob)
            candidates = {
                key: value
                for key, value in candidates.items()
                if matcher(_relative_to_root(key, root))
            }
        return list(candidates)

    def grep(
        self,
        pattern: str,
        path: str | None = None,
        glob: str | None = None,
        *,
        max_count: int | None = None,
    ) -> GrepResult:
        try:
            paths = self._grep_paths(path, glob)
        except ValueError as exc:
            return GrepResult(error=str(exc))
        files: dict[str, FileData] = {}
        for key in paths:
            item = self._get_store().get(self._get_namespace(), key)
            if item is None:
                return GrepResult(error=f"File '{key}' not found")
            try:
                files[key] = self._convert_store_item_to_file_data(item)
            except (ValueError, TypeError) as exc:
                return GrepResult(error=str(exc))
        return grep_matches_from_files(files, pattern, max_count=max_count)

    async def agrep(
        self,
        pattern: str,
        path: str | None = None,
        glob: str | None = None,
        *,
        max_count: int | None = None,
    ) -> GrepResult:
        try:
            paths = self._grep_paths(path, glob)
        except ValueError as exc:
            return GrepResult(error=str(exc))
        files: dict[str, FileData] = {}
        for key in paths:
            item = await self._get_store().aget(self._get_namespace(), key)
            if item is None:
                return GrepResult(error=f"File '{key}' not found")
            try:
                files[key] = self._convert_store_item_to_file_data(item)
            except (ValueError, TypeError) as exc:
                return GrepResult(error=str(exc))
        return grep_matches_from_files(files, pattern, max_count=max_count)

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

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        return [
            FileDownloadResponse(path=path, content=None, error="permission_denied")
            for path in paths
        ]

    async def adownload_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        return self.download_files(paths)
